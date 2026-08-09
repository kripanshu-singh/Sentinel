# Sentinel — Roadmap

Status legend: `[x] done · [~] in progress · [ ] planned`

## Phase 0 — Foundation
- [x] Scaffold Next.js 16 + shadcn/ui (base-nova) project.
- [x] `context/` project documentation (overview, architecture, UI, standards, decisions).
- [x] Install `zod` and `@tanstack/react-query`; wire the QueryClientProvider in `src/app/layout.tsx`.
- [x] Establish shared domain types in `src/types/` (`GoalInput`, `AgentEvent`, `ApprovalRequest`, `ReconciliationReport`, …).

## Phase 1 — Frontend MVP & SPA Experience
- [x] Single-Page Application (SPA) Goal input screen (`/app`) with ambient teal background glow, goal textarea, and Business Rules (target price, subtotal, threshold, coupon, fallback, credentials).
- [x] Landing/marketing page at `/` (hero, run-board demo, capabilities, at-work gallery, FAQ) with light theme, brand logo, and CTAs into the console.
- [x] Create-run flow: Zod-validated API route → worker start → route to `/runs/[runId]`.
- [x] Live run screen: SSE timeline of `AgentEvent`s via `useRunStream` with live browser capture preview and instant reactive HITL alerts.
- [x] HITL modal: `ApprovalRequest` → **Approve & Continue / Override Target / Abort** → resolution sent back.
- [x] **Live steering (ADR-012):** always-visible "Steer the agent" control on the live run screen; `STEER` event; instruction folded into the plan at the next step boundary.
- [x] Result screen: itemized invoice `Table`, discrepancy/human-confirmed flags, CSV export.

## Phase 2 — Worker Service (in-tree `worker/`)
- [x] Agent orchestration as a LangGraph.js `StateGraph` (ADR-011): `plan → execute ⇄ extract/validate → report`, HITL gate, bounded replan loop (`worker/src/agent/graph/`).
- [x] **Site-Agnostic Resolution (ADR-013):** clean prompt query extraction (`extractCleanProductName`) and direct search URL resolution (`resolveStorefrontUrl`) across global e-commerce portals (eBay, Amazon, Flipkart, Target, Best Buy, B&H Photo, SauceDemo).
- [x] **Stealth Navigation (ADR-014):** Chromium `--disable-http2` HTTP/1.1 navigation to bypass Cloudflare/Akamai stream resets + image resource passthrough for live browser capture preview.
- [x] Rule engine: variance, margin, coupon-required checks against `GoalInput` (`worker/src/agent/rule-engine.ts`).
- [x] LLM orchestration: Gemini primary, OpenRouter/Groq/Ollama fallback, structured output.
- [x] SSE event stream down + HTTP HITL resolution up; Redis pub/sub + BullMQ queue.
- [x] Read-Only vs Purchase workflow separation: read-only price/stock queries omit `add_to_cart` and checkout steps cleanly.

## Phase 3 — Reconciliation Engine & Hardening
- [x] Normalized invoice/line-item extraction from final review screen.
- [x] `ReconciliationReport` generation + persistence (PostgreSQL).
- [x] Multi-channel pricing audit (per-channel snapshots, variance vs threshold, HITL on large gaps).
- [x] CSV export of invoice/report from result screen.
- [x] Local PostgreSQL (`breakmyapi`) and Redis integration.
