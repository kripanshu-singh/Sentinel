# Sentinel — Architecture

## Why this shape (read this first)

The system is split into a **Next.js frontend** and a **separate worker service**. That split is
deliberate; it is driven by the hard constraints of an *acting* agent, not by taste:

1. **Long-lived browser sessions cannot run on serverless.** An agent run opens Playwright,
   navigates a storefront, and streams events for several minutes. Serverless functions on
   Vercel have execution time limits and are request/response oriented — keeping a browser alive
   and streaming continuously is painful and unreliable there.
2. **The UI must never own stateful automation.** The frontend is declarative: it renders a
   goal form, a live event stream, and a result table. Keeping browser state in the UI would
   couple rendering to automation and make recovery impossible.
3. **HITL is bidirectional.** The worker must *pause* mid-run and *wait* for a human decision,
   then resume. That requires a durable, long-lived process (the worker) plus a streaming
   channel down and a resolution channel back up. A thin request/response API can't express a
   run that waits minutes at an approval gate.
4. **Failure isolation.** If the browser or an LLM call crashes, the UI stays up, the run is
   marked failed/recoverable, and the timeline shows exactly where it broke.
5. **The contract, not the implementation, is shared.** This repo defines the domain types and
   event schema. The worker implements against that contract. Both sides stay in sync without
   the frontend knowing Playwright or LLM details.

## High-Level System

```
┌───────────────────────────────────┐          ┌──────────────────────────────────────┐
│   Next.js (this repo)  Frontend   │          │   Worker / Backend (in-tree `worker/`)│
│   - Goal input screen             │          │   - Agent orchestration (LangGraph.js │
│   - Live run screen (event stream)│          │     StateGraph, see ADR-011)          │
│   - HITL approval modal           │          │   - LLM calls (Gemini 2.5 Flash,     │
│   - Result screen (table + CSV)   │  HTTP/SSE │     OpenRouter/Groq/Ollama fallback) │
│   - Thin API routes (Zod-validated)│◄────────►│   - Playwright browser session      │
│                                   │ WebSocket │   - Rule engine (variance, margin)  │
└───────────────────────────────────┘          │   - HITL pause/resume coordinator    │
                                               └───────────────┬──────────────────────┘
                                                               │
                                               ┌───────────────▼──────────────────────┐
                                               │  PostgreSQL (runs, approvals,        │
                                               │   reports, history)                  │
                                               │  Redis (job queue, run state,        │
                                               │   pub/sub for HITL + events)         │
                                               └──────────────────────────────────────┘
```

### Layer responsibilities

- **Next.js frontend** — goal input, live run timeline, HITL modal, result/report table with
  CSV export. The "API" here is a thin proxy layer (`src/server/`) that validates input
  with Zod and talks to the worker. No Playwright, no agent-orchestration LLM logic in this
  repo — the sole exception is the intent gatekeeper (`src/server/intent-classifier.ts`,
  `POST /api/intent`), a stateless per-prompt classifier that decides whether a prompt is a
  browser task before a run is enqueued (see ADR-010).
- **Worker service** (`worker/`, in-tree) — owns the agent graph: a LangGraph.js
  `StateGraph` that runs `plan → execute (step machine) ⇄ extract/validate → report`,
  with a HITL gate (`validate → hitl`) and a bounded replan loop
  (`validate/execute → replan → execute`) — see ADR-011 and
  `.ai/langgraph-migration.md`. Owns the Playwright browser (via `SessionManager` / `navigator.ts`),
  which executes stealth HTTP/1.1 navigation (`--disable-http2` to bypass stream resets) and
  enables product image rendering for live browser captures. Implements clean query normalization
  (`extractCleanProductName`), direct search URL resolution (`resolveStorefrontUrl`), LLM DOM
  extraction, and rule validation. Streams events down; accepts resolutions up.
- **PostgreSQL** — durable records: agent runs, approvals, discrepancies, generated reports.
- **Redis** — job queue for runs, ephemeral run state, and pub/sub used to fan events to
  subscribers and wake the worker on HITL resolution.

## Why each channel exists

- **SSE (worker → frontend):** the worker pushes `AgentEvent`s as a run progresses. The live
  run screen subscribes and renders each step as it happens. One-way, simple, resilient to
  reconnects.
- **WebSocket / HTTP (frontend → worker):** used for HITL resolution (`approve`, `override`,
  `abort`), **live steering** (`POST /runs/:id/steer` — a free-form operator instruction fed to
  the worker at the next step boundary, see ADR-012), and start/cancel of runs. Bidirectional
  and rare, so it stays cheap.
- **Thin REST (frontend API):** create a run, fetch a run's summary, fetch the final report.
  These are validated with Zod in `src/server/` and proxied to the worker/storage.

## Agent Run Lifecycle (the state machine)

```
PARSED ──► NAVIGATING ──► EXTRACTING ──► CHECKING
                                           │
                 low confidence / missing? ─┤ yes ──► RECOVERING (replan, per-node cap)
                                           │ no              │ revised plan
                                           │                 └──► NAVIGATING (replay)
                      threshold crossed? ──┤ no ──► (auto-continue)
                                    │ yes
                                    ▼
                               HITL_PENDING ◄── emits approval request, waits
                                    │  resolve: approve | override | abort
                                    ├─ approve ──► RESUME
                                    ├─ override ─► CHECKING (recompute against new target)
                                    └─ abort ────► ABORTED
   RESUME ──► FORM_FILLING ──► VALIDATING
                                    │  coupon/field failure?
                                    ├─ no ──► DRAFT_READY ──► DONE
                                    └─ yes ► RECOVERING (fallback policy) ──► DRAFT_READY
                                        │  step error (bounded replan) ─► RECOVERING ─► retry
```

`ABORTED`, `DONE`, and `FAILED` are terminal. `FAILED` is used only for unrecoverable
engineering errors or a replan budget exhausted after 2 retries; business rule failures
always route through `RECOVERING` or `HITL_PENDING`. The worker implements this state
machine as a LangGraph.js `StateGraph` (`worker/src/agent/graph/`) — see ADR-011.

## Worker module layout (`worker/`, in-tree)

```
worker/src/
  index.ts          # Express server + BullMQ worker bootstrap
  routes/           # /runs, /runs/:id, /runs/:id/resolve, /runs/:id/stream
  queue/jobs.ts     # BullMQ job handler → runGraph(runId, input)
  agent/
    graph/          # LangGraph.js StateGraph (ADR-011)
      state.ts      #   SentinelState schema + reducers
      graph.ts      #   buildSentinelGraph() + runGraph()
      emit.ts       #   shared side effects (DB insert + Redis pub/sub)
      retry.ts      #   MAX_RETRIES_PER_NODE, retryUpdate(), failRun()
      nodes/        #   plan | execute | extract | validate | hitl | replan | report_node
    actions/        # tiny action executors (navigate/search/addToCart/coupon/fill/screenshot)
    session/        # SessionManager — browser lifecycle outside graph state
    planner.ts      # LLM goal → PlanResult (+ failure context for replan)
    navigator.ts    # Playwright wrapper (reused)
    extractor.ts    # DOM → { product, confidence } / invoice
    rule-engine.ts  # checkProduct / recheck (pure rules)
    coupon.ts, form-filler.ts
  storage/          # db.ts (Postgres schema), redis.ts (queue, pub/sub, BLPOP HITL)
  types/            # worker-side mirror of the shared contract
```

## Module Boundaries (Next.js app)

```
src/
  app/            # App Router pages
    page.tsx            # Goal input
    runs/[runId]/       # Live run screen
    runs/[runId]/result # Result/report screen
  components/     # UI components (shadcn/ui + feature components)
    ui/           # shadcn base components (generated — do not hand-edit)
    goal-input/   # goal form + business rule editor
    run/          # timeline, event row, status badges
    hitl/         # approval modal + resolution buttons
    report/       # reconciliation table, discrepancy highlights, CSV export
  lib/            # utils, api clients, format helpers
  hooks/          # shared React hooks (useRunStream, useResolveHITL, react-query hooks)
  server/         # server-only logic: thin API routes, Zod schemas, worker proxy
  types/          # shared domain types (the contract)
```

## The Contract (shared domain types in `src/types/`)

These are the wire contract between frontend and worker. Worker code must map to the same
shapes. Changing them is a cross-service change — update every consumer.

- `GoalInput` — user's natural-language goal + parsed business rules (target price,
  variance threshold, coupon code, quantities, fallback policy).
- `BusinessRule` — `{ targetPrice, varianceThreshold, requiresCoupon, fallbackPolicy }`.
- `RunStatus` — `PARSED | NAVIGATING | EXTRACTING | CHECKING | HITL_PENDING | RESUME |
  FORM_FILLING | VALIDATING | RECOVERING | DRAFT_READY | DONE | ABORTED | FAILED`.
- `AgentEvent` — one streamed step: `{ id, runId, step, status, title, detail, evidence?,
  at }` where `step` is `NAVIGATE | SEARCH | EXTRACT | CHECK | HITL | FORM_FILL | VALIDATE |
  RECOVER | DRAFT | STEER`. `STEER` acknowledges a live operator instruction (ADR-012);
  its `evidence.instruction` carries the text.
- `SteerInstruction` — a live operator redirect: `{ instruction }`, pushed via
  `POST /runs/:id/steer` and drained by the `execute` node at step boundaries.
- `Discrepancy` — `{ kind: "price"|"discount"|"inventory"|"margin", expected, actual,
  variancePct, threshold, severity }`.
- `ApprovalRequest` — `{ id, runId, title, detail, discrepancies[], resolution? }`.
- `ApprovalResolution` — `"approve" | "override" | "abort"` + optional `overrideTarget`.
- `ChannelSnapshot` — `{ channel, price, discount, shipping, computedMargin }`.
- `LineItem` — normalized invoice row `{ sku, description, quantity, unitPrice, lineTotal,
  discounts, status }`.
- `ReconciliationReport` — `{ runId, generatedAt, items: LineItem[], discrepancies[],
  channels: ChannelSnapshot[], summary }`.

## Conventions

- **Server-first.** Pages are Server Components; only the live run stream, HITL modal, and
  interactive tables are `"use client"`.
- **Every boundary is Zod-validated.** `src/server/` validates incoming requests and worker
  responses before anything downstream touches them.
- **External services live behind interfaces** in `src/server/` (worker proxy, CSV export) so
  they can be mocked in tests.
- **No secrets in the browser bundle.** API keys, LLM credentials, DB URLs live only in the
  worker and server env.
- **The worker lives in-tree at `worker/`.** It is a separate service *process* (own port,
  own BullMQ + Playwright) but shares this repository, so its code is reviewed, tested, and
  versioned with the frontend (see ADR-011). The shared contract in `src/types/` is the
  seam between them.
