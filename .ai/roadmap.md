# Sentinel — Roadmap

Status legend: `[x] done · [~] in progress · [ ] planned`

## Phase 0 — Foundation
- [x] Scaffold Next.js 16 + shadcn/ui (base-nova) project.
- [x] `.ai/` project documentation (overview, architecture, UI, standards, decisions).
- [ ] Install `zod` and `@tanstack/react-query`; wire the QueryClientProvider in `src/app/layout.tsx`.
- [ ] Establish shared domain types in `src/types/` (`GoalInput`, `AgentEvent`, `ApprovalRequest`, `ReconciliationReport`, …).

## Phase 1 — Frontend MVP
- [ ] Goal input screen (`/`) with goal textarea + business rules (target price, threshold, coupon, fallback).
- [ ] Create-run flow: Zod-validated API route → worker start → route to `/runs/[runId]`.
- [ ] Live run screen: SSE timeline of `AgentEvent`s via `useRunStream`.
- [ ] HITL modal: `ApprovalRequest` → **Approve & Continue / Override Target / Abort** → resolution sent back.
- [x] **Live steering (ADR-012):** always-visible "Steer the agent" control on the live run
      screen; `STEER` event; instruction folded into the plan at the next step boundary.
- [ ] Result screen: invoice `Table`, discrepancy/human-confirmed flags, CSV export.

## Phase 2 — Worker service (in-tree `worker/`)
- [x] Agent orchestration as a LangGraph.js `StateGraph` (ADR-011): `plan → execute ⇄ extract/validate → report`, HITL gate, bounded replan loop (`worker/src/agent/graph/`). Replaced the old `AgentRunner` step-loop.
- [x] Playwright browser session + storefront navigation/search/extraction (via `SessionManager` + action executors).
- [x] Rule engine: variance, margin, coupon-required checks against `GoalInput` (`worker/src/agent/rule-engine.ts`).
- [x] LLM orchestration: Gemini 2.5 Flash primary, OpenRouter/Groq/Ollama fallback, structured output.
- [x] SSE event stream down + HTTP HITL resolution up; Redis pub/sub + BullMQ queue.
- [x] Graceful recovery: coupon/field failures → `RECOVERING` fallback policy; extraction/step failures → bounded replan → `FAILED` at cap.

## Phase 3 — Reconciliation engine
- [ ] Normalized invoice/line-item extraction from the final review screen.
- [ ] `ReconciliationReport` generation + persistence (PostgreSQL).
- [ ] Multi-channel pricing audit (per-channel snapshots, variance vs threshold, HITL on large gaps).
- [ ] CSV export of invoice/report from the result screen.

## Phase 4 — Hardening
- [ ] Run history and dashboard listing.
- [ ] Run state durability + reconnect-safe streaming (no event loss on SSE reconnect).
- [ ] Rate limits, structured error handling, and timeouts for `HITL_PENDING`.
- [ ] Test coverage (Zod schema tests, rule engine, CSV escaping, timeline reducer).
- [ ] Deployment: frontend on Vercel, worker on Railway/Render; env/secrets handling.

## Phase 5 — Trust & Scale
- [ ] Multi-tenant auth + run isolation.
- [ ] Invoice/report schema versioning and migrations.
- [ ] Observability (run logs, LLM latency, browser session metrics).
- [ ] Optional: expand LLM routing, headless browser pool, opt-in telemetry.
