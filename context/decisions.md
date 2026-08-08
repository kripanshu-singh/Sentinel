# Sentinel — Decisions Log

Every architecture/product decision lives here as a lightweight ADR (decision record). New
entries are appended **at the top** of their section with a date and a `Status`. Code must
respect these decisions; if a decision is wrong, change the record first, then the code.

## Product & Architecture

### ADR-014 — HTTP/1.1 Stealth Navigation & Visual Image Capture
- **Status:** Accepted (2026-08-08)
- **Context:** Cloudflare/Akamai bot walls (Myntra, Ajio) send HTTP/2 `RST_STREAM` frame resets to headless Playwright browsers, causing `net::ERR_HTTP2_PROTOCOL_ERROR` crashes. Additionally, aggressive image blocking hid product photos in live UI screenshots.
- **Decision:** Launch Playwright Chromium with `--disable-http2` to force HTTP/1.1, eliminating connection resets. Unblock image resource types (`png, jpg, webp, svg`) while continuing to block heavy video media and web fonts.
- **Consequences:** Multi-storefront navigation works reliably without stream resets, and live UI captures display full, crisp product photos.

### ADR-013 — Site-Agnostic Direct Search Resolution & Clean Query Normalization
- **Status:** Accepted (2026-08-08)
- **Context:** Storefront homepages often contain popups, captchas, or login prompts. Searching directly via URL parameter skips homepages completely and reduces navigation latency by ~60%.
- **Decision:** Implement `extractCleanProductName` to strip conversational preambles ("So my target price is $20 and please search..."), target price clauses, and storefront suffixes. Implement `resolveStorefrontUrl` to map goal text (eBay, Amazon, Flipkart, Target, Best Buy, Walmart, Myntra, Ajio) to direct search URLs (`_nkw`, `q`, `k`, `st`). Default unmapped queries to eBay direct search instead of SauceDemo.
- **Consequences:** Prompt queries like *"Find Sony WH-1000XM5 on eBay"* navigate straight to search results without hitting homepages or embedding conversational preambles in search params.

### ADR-012 — Live steering: operator instruction channel at step boundaries
- **Status:** Accepted (2026-08-07)
- **Context:** HITL pauses only at a formal `validate → hitl` gate (a crossed
  threshold or an explicit `pause_for_approval`). Between gates the agent runs
  autonomously and the operator has no way to redirect it — a wrong product, an
  overlooked quantity, or a change of plan is unrecoverable until the next pause.
  A LangGraph `interrupt()` + checkpointer would solve this properly but is a
  deferred production-hardening item (see ADR-011 and `.ai/langgraph-migration.md`
  §8). We need steering now, with the existing BLPOP/no-checkpointer stack.
- **Decision:** Add an **asynchronous steer channel**: the frontend pushes a
  free-form instruction to the worker via a new `POST /runs/:id/steer` route,
  which stores it on a per-run Redis list (`run:{runId}:steer`). The graph's
  `execute` node drains that queue **at every step boundary**; when a steer is
  pending, it emits a `STEER` event (acknowledgement in the timeline) and routes
  to the existing `replan` node, which already treats `human_instruction` entries
  in `replanContext` as the highest-priority requirement. No checkpointer needed;
  the steer takes effect within one step's execution latency.
- **Consequences:** `AgentEventType` gains `STEER` (additive; the timeline label
  map already falls back to the raw string). The frontend gains an always-visible
  "Steer the agent" control on the live run screen (independent of the HITL
  modal). Steers are applied as plan revisions, never as live mutations of an
  in-flight step — a step that already started completes, then the next one
  honors the steer. `STEER` is acknowledged even for terminal runs' post-mortem
  review, but the steer route rejects steers for `DONE`/`FAILED`/`ABORTED` runs.

### ADR-011 — Worker orchestration on LangGraph.js (in-tree worker/)
- **Status:** Accepted (2026-08-06)
- **Context:** `AgentRunner`'s linear switch over a `StepPlan[]` cannot express
  validator-driven replan loops or bounded retry without growing into a 600-line
  switch. The worker actually lives in-tree at `worker/` (contrary to earlier
  "separate repo" wording in ADR-002/architecture docs).
- **Decision:** Orchestrate the worker with **LangGraph.js** `StateGraph`.
  Deterministic edges for the happy path; conditional edges only for
  `validate → replan` (per-node retry cap) and `validate → HITL`. A
  **SessionManager** owns the Playwright browser lifecycle (graph state stores a
  `sessionId` only, never `Page`/`Browser`/`Context`). Tiny **action executors**
  (navigate/search/fill/click/wait/screenshot) keep nodes small. Keep the existing
  **Redis BLPOP HITL** for MVP — swappable to `interrupt()` + persistent checkpointer
  later without graph changes. Keep the existing `LLMProvider` abstraction and event
  streaming; keep the shared frontend contract (`src/types/`) unchanged.
- **Consequences:** `worker/` gains `@langchain/langgraph`; `worker/src/agent/runner.ts`
  is removed at the end of the migration; `.ai/architecture.md` and `roadmap.md` are
  updated to reflect the in-tree worker and graph orchestration. See
  `.ai/langgraph-migration.md` for the phased plan.

### ADR-010 — Intent gatekeeper LLM call lives in the frontend (exception to ADR-002)
- **Status:** Accepted (2026-08-06)
- **Context:** An agent that launches a browser session on every message wastes a
  Playwright session on chitchat ("hi", "2+2"). Every prompt should be classified
  before a run is enqueued. A per-prompt request/response LLM call fits serverless
  naturally — it needs no long-lived process, no browser, no state.
- **Decision:** The Next.js app owns a lightweight intent gatekeeper: a Zod-validated
  `POST /api/intent` route that classifies the prompt with a cheap LLM (Gemini Flash
  via `GEMINI_API_KEY`) into `CONVERSATIONAL | CAPABILITY_QUERY | AUTOMATION_TASK`.
  Only `AUTOMATION_TASK` enqueues a run with the worker; the other two return a direct
  text reply or structured help. This is the **single exception** to ADR-002's "no LLM
  in the frontend" rule — all orchestration/reasoning LLM calls remain in the worker.
- **Consequences:** The classifier is a thin, stateless service behind an interface
  (`src/server/intent-classifier.ts`) with a rule-based fallback when the LLM is
  unreachable. `architecture.md`'s "no LLM logic in this repo" wording is amended to
  reflect this exception.

### ADR-001 — Next.js + shadcn/ui (base-nova) foundation
- **Status:** Accepted (2026-08-06)
- **Context:** Need a fast, type-safe frontend with a modern design system for the B2B
  reconciliation agent.
- **Decision:** Next.js 16 (App Router, Turbopack) + React 19 + TypeScript strict + Tailwind v4
  + shadcn/ui **base-nova** (Base UI primitives, lucide icons, Geist fonts).
- **Consequences:** The pinned Next.js version has breaking changes; agents must consult
  `node_modules/next/dist/docs/`. UI must use semantic tokens and shadcn conventions (see
  `.ai/ui_context.md`).

### ADR-002 — Frontend / worker split (two deployables)
- **Status:** Accepted (2026-08-06)
- **Context:** Agent runs keep a Playwright browser alive and stream events for minutes.
  Serverless functions have execution time limits and are request/response oriented; keeping a
  browser session streaming reliably on pure serverless is impractical.
- **Decision:** This repo is the **Next.js frontend** (goal input, live run, HITL modal, result
  + CSV export) with a thin Zod-validated API layer. The **worker** (agent orchestration,
  Playwright, LLM, rule engine) is a **separate long-running service** in its own repo.
- **Consequences:** Frontend never owns browser state; the shared contract is the domain types
  in `src/types/`. See `.ai/architecture.md`.

### ADR-003 — Human-in-the-loop before high-stakes actions
- **Status:** Accepted (2026-08-06)
- **Context:** An *acting* agent can spend real money if it completes orders without guardrails
  (wrong price, failed coupon, policy override). Guardrail-first is a core product principle.
- **Decision:** Any threshold-crossing action pauses the run and emits an `ApprovalRequest`.
  The human resolves with **Approve & Continue**, **Override Target**, or **Abort**. The agent
  never places or submits the final order — it stops at the review/draft screen.
- **Consequences:** `RunStatus` includes `HITL_PENDING`; the worker blocks on resolution;
  flagged report items must be marked as human-confirmed.

### ADR-004 — Streaming: SSE down, WebSocket/HTTP up
- **Status:** Accepted (2026-08-06)
- **Context:** The live run screen needs a push of `AgentEvent`s, and HITL resolution must go
  back to a paused worker.
- **Decision:** Worker → frontend uses **SSE** (one-way, reconnect-friendly). Frontend → worker
  uses **WebSocket/HTTP** for run start/cancel and HITL resolution. Thin REST endpoints (with
  Zod) serve run summaries and reports.
- **Consequences:** `useRunStream` hook handles reconnects; the timeline must never lose events
  on reconnect.

### ADR-005 — LLM strategy
- **Status:** Accepted (2026-08-06)
- **Context:** Need structured, tool-calling-capable LLM reasoning for plan/act/observe, with
  zero/low cost and a fallback path.
- **Decision:** **Gemini 2.5 Flash / 2.0 Flash** as primary (Google AI Studio free tier,
  structured output + tool calling). Fallback: **OpenRouter / Groq / Ollama** via multi-provider
  routing in the worker.
- **Consequences:** LLM credentials live only in the worker/server env, never in the browser.
  The worker abstracts providers behind an interface.

### ADR-006 — Validation: Zod at every boundary
- **Status:** Accepted (2026-08-06)
- **Context:** The frontend talks to a remote worker; raw input and worker responses are
  untrusted.
- **Decision:** Every API route, server action, and worker-response boundary validates with
  Zod. Types are inferred from schemas with `z.infer`. Schemas live in `src/server/`.
- **Consequences:** Add `zod` (`npm install zod`) before first use. Domain types stay in
  `src/types/` and are validated at boundaries.

### ADR-007 — Server state via React Query
- **Status:** Accepted (2026-08-06)
- **Context:** Run summaries, reports, and mutations need consistent caching/invalidation
  without hand-rolled fetch state.
- **Decision:** `@tanstack/react-query` for all server state (`useQuery` / `useMutation` with
  stable keys). Live events use a dedicated `useRunStream` SSE hook, not React Query.
- **Consequences:** Add `@tanstack/react-query` (`npm install @tanstack/react-query`) before
  first use; provider wraps the app in `src/app/layout.tsx`.

## Data & Infra

### ADR-008 — Storage: PostgreSQL + Redis
- **Status:** Accepted (2026-08-06)
- **Context:** Durable records (runs, approvals, reports, history) plus ephemeral run state and
  pub/sub for HITL/events.
- **Decision:** **PostgreSQL** (Supabase/Neon) for durable data; **Redis** (Upstash/Redis
  Cloud) for the job queue, ephemeral run state, and event fan-out.
- **Consequences:** Live run state is ephemeral (Redis); history/reports are durable
  (Postgres). Both live server-side in the worker/storage layer.

### ADR-009 — Scraper engine in the worker (Playwright)
- **Status:** Accepted (2026-08-06)
- **Context:** Storefront automation needs a real browser, DOM selectors, and async control.
- **Decision:** **Playwright** runs inside the worker service (not the Next.js app), controlled
  by the agent step loop.
- **Consequences:** The worker is a long-running Node process with browser lifecycle and
  session management. The frontend only ever sees normalized `AgentEvent`s.

## Open Questions

- Invoice/report schema versioning across runs (migrations for `ReconciliationReport`).
- Multi-tenant auth / run isolation (public SaaS later; single-tenant local for MVP).
- Browser pool sizing and headless/headed mode per environment.
- Whether the rule engine stays rule-based for MVP or is a rules + LLM hybrid.
- Deployment of the worker (Railway / Render free tiers) and Vercel env for the frontend.
