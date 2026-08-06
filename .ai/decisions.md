# Sentinel — Decisions Log

Every architecture/product decision lives here as a lightweight ADR (decision record). New
entries are appended **at the top** of their section with a date and a `Status`. Code must
respect these decisions; if a decision is wrong, change the record first, then the code.

## Product & Architecture

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
