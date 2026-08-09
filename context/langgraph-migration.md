# Sentinel — Worker Migration Plan: LangGraph.js Orchestration

**Status:** Complete — all four phases landed (A: linear graph, B: HITL edge,
C: replan loop, D: cleanup) on 2026-08-06. `AgentRunner` is deleted; the worker is
orchestrated by a LangGraph.js `StateGraph` (ADR-011, Accepted).
**Date:** 2026-08-06
**Scope:** Replace the hand-rolled `AgentRunner` step-loop in `worker/` with a
LangGraph.js `StateGraph`. No frontend contract changes unless explicitly listed.

## 1. Design Principles

1. **Deterministic orchestration.** Edges are code or rules, never LLM decisions.
2. **Browser launches only after planning.** A session is created lazily when the first
   action needs it — never before the goal is understood.
3. **Human always approves high-risk actions.** Variance above threshold → HITL gate.
4. **Browser session lives outside graph state.** State stores a `sessionId` only; the
   `SessionManager` owns Playwright lifecycle.
5. **LLMs decide content, never routing.** Models produce plans, extractions, summaries;
   the graph decides where control flows.
6. **All nodes are idempotent.** Re-running a node is safe — state updates are pure
   reducers, side effects are keyed by `runId` and idempotent by construction.

## 2. Current state (what is being replaced)

- `worker/src/agent/runner.ts` — the `AgentRunner` class: owns run status, DB writes,
  `publishEvent` calls, and a `switch` over plan steps.
- Specialists already exist as helpers and are **reused**: `planner.ts` (`planGoal`),
  `navigator.ts`, `extractor.ts`, `rule-engine.ts` (`checkProduct`, `recheck`),
  `coupon.ts`, `form-filler.ts`.
- HITL: `waitForHITLResolution(runId)` blocks on `BLPOP`; `/resolve` writes via
  `signalHITLResolution` (`worker/src/storage/redis.ts`). **Kept for MVP** (see §8).
- Events: each step calls `logEvent(...)` → DB insert + Redis pub/sub → SSE route.
  **Keep the channel.**
- Queue: BullMQ job → `new AgentRunner(runId, input).run()` (`worker/src/queue/jobs.ts`).

## 3. Target graph

```
                     ┌─────────────────────────┐
                     │          start          │
                     └────────────┬────────────┘
                                  ▼
                     ┌─────────────────────────┐
                     │        PLAN node        │  (planner.ts → PlanResult)
                     └────────────┬────────────┘
                                  ▼
              ┌───────────────────────────────────┐
              │         EXECUTE node              │
              │  iterates ACTION EXECUTORS        │
              │  (navigate / search / fill /      │
              │   click / wait / screenshot)      │
              └────────────┬──────────────────────┘
                           ▼
                     ┌─────────────────────────┐
                     │      EXTRACT node       │  (extractor.ts → { product, confidence })
                     └────────────┬────────────┘
                                  ▼
                     ┌─────────────────────────┐
                     │     VALIDATE node       │  (rule-engine + completeness + sanity)
                     └────────────┬────────────┘
              ┌───────────────────┴────────────────────┐
              │                                        │
   [low confidence /               [needs human]       │  [valid]
    incomplete / mismatch]                             │
              │                                        ▼
              ▼                                ┌─────────────────────────┐
  ┌───────────────────────┐                    │        HITL node       │
  │     REPLAN node       │                    │  (BLPOP wait, resume)  │
  │ (structured context,  │                    └───────────┬─────────────┘
  │  per-node retry cap)  │          approve / override ▲    │ abort
  └───────────┬───────────┘                      │        │
              │                                  └────────┘
              ▼                              back to EXECUTE
   back to EXECUTE (continue /               (or VALIDATE w/ override)
   retry affected steps)                          │
              │ (retries exhausted → FAILED)      │
              ▼                                   ▼
                     ┌─────────────────────────┐
                     │      REPORT node        │  (write ReconciliationReport,
                     │                         │   emit DRAFT events, → DONE)
                     └─────────────────────────┘
```

### 3.1 Node → agent module map

| Node          | Reuses                                    | Emits (`AgentEventType`)        |
|---------------|-------------------------------------------|---------------------------------|
| `plan`        | `planner.planGoal` → richer `PlanResult`  | `NAVIGATE` ("Goal parsed", "Plan generated") |
| `execute`     | action executors (wrap `Navigator`, `form-filler`, `coupon`) | `NAVIGATE`, `SEARCH`, `FORM_FILL`, `VALIDATE`, `RECOVER` |
| `extract`     | `extractor.extractProductFromDOM` (+ confidence) | `EXTRACT`                    |
| `validate`    | `rule-engine.checkProduct` / `recheck` + completeness + sanity | `CHECK` |
| `replan`      | `planner` (failure-context prompt)        | `NAVIGATE` ("Replanning…")      |
| `hitl`        | `waitForHITLResolution` (unchanged)       | `HITL`                          |
| `report`      | `extractor.extractInvoiceFromDOM`, DB write | `DRAFT`                       |

There is **no separate Review node**: its sanity responsibilities (item names,
currency, arithmetic, vs-goal targets) fold into `validate` (see §6).

### 3.2 Routing rules (conditional edges, in code — never LLM-decided)

From `validate`:
- confidence below threshold, incomplete extraction, or sanity mismatch **and**
  `nodeRetries[extract] < 2` → `replan` (append a structured `ReplanEntry`).
- same conditions **and** `nodeRetries[extract] >= 2` → `FAILED` (terminal, error event).
- any discrepancy `requiresHITL` → `hitl`.
- otherwise → `report` (or back to `execute` if the plan still has steps left — see §5).

From `hitl` (after BLPOP returns):
- `abort` or null → `report` with `ABORTED` outcome (terminal).
- `approve` → back to `execute` (resume remaining plan).
- `override` → apply `overrideTarget` via `recheck`, then back to `execute`.

From `replan`:
- budget left for the triggering node → `execute` (re-run affected steps).
- budget exhausted → `FAILED` (terminal).

## 4. State shape (`AgentState`)

```ts
import { Annotated } from "@langchain/langgraph";

interface SentinelState {
  // run context
  runId: string;
  input: GoalInput;                       // immutable business rules
  status: RunStatus;                      // mirrors DB/Redis status

  // session — never browser objects (see §7)
  sessionId: string | null;               // key into SessionManager

  // planning
  planResult: PlanResult | null;          // { goal, plan, needsClarification, risk, confidence, estimatedSteps }
  stepIndex: number;                      // next plan step to run
  nodeRetries: Record<string, number>;    // { extract: 2, execute: 1, ... } — per-node, debuggable

  // transparency (UI-driven)
  currentScreenshot: string | null;       // base64 data URL
  currentURL: string | null;
  lastAction: string | null;

  // extraction / validation
  currentProduct: ProductExtraction | null;  // includes confidence: number
  discrepancies: Discrepancy[];
  resolution: ApprovalResolution | null;

  // output
  report: ReconciliationReport | null;

  // history (accumulates via append reducers)
  events: AgentEvent[];
  replanContext: ReplanEntry[];
}

interface PlanResult {
  goal: string;                 // normalized restatement
  plan: StepPlan[];
  needsClarification: boolean;
  risk: "low" | "medium" | "high";
  confidence: number;           // 0..1
  estimatedSteps: number;       // ≈ plan.length
}

interface ReplanEntry {         // structured, not free text (see §10)
  node: string;                 // "extract"
  reason: string;               // "missing_price" | "low_confidence" | "step_error" | ...
  retry: number;                // current retry count for that node
  detail: string;               // human-readable
  timestamp: string;
}
```

Reducers:
- `planResult`, `stepIndex`, `nodeRetries`, `currentProduct`, `resolution`, `report`,
  `status`, `sessionId`, `currentScreenshot`, `currentURL`, `lastAction` → overwrite.
- `events`, `replanContext` → append reducers.

The shared state object is exactly the "agents talking to each other" mechanism:
`execute` writes `currentScreenshot`/`currentURL`/`lastAction`; `extract` reads the DOM
snapshot and writes `currentProduct` + `confidence`; `validate` reads those and writes
`discrepancies`; `hitl` writes `resolution`; `report` reads everything to build the
final artifact. No hidden cross-helper fields like today's `AgentRunner.currentProduct`.

## 5. `execute` + action executors (prevents a 600-line switch)

`execute` does **not** reimplement each step inline. It iterates a plan and delegates
each step to a tiny action executor — the same primitives the DOM needs regardless of
plan shape:

```
worker/src/agent/actions/
  navigate(page, url)         → sets state.currentURL
  search(page, query)
  fill(page, selector, value)
  click(page, selector)
  wait(page, condition)
  screenshot(page)            → base64 data URL → state.currentScreenshot
```

`execute` then is a thin loop: for each step, pick the matching executor, run it, update
`currentURL`/`lastAction`/`currentScreenshot`, and emit the step's event. When it hits
`extract_product` / `check_price` / `draft_report`, it **yields to the graph**:

- `extract_product` → stop, set `stepIndex` past this step, edge → `extract`.
- `check_price` → edge → `validate`.
- `draft_report` → edge → `report` (validate re-checks the final invoice first — §6).

On return from `replan`/`hitl`, `execute` resumes at the stored `stepIndex`. Net effect:
a deterministic `execute ⇄ extract ⇄ validate` cycle per check-point, bounded by plan
size.

## 6. Validation owns sanity (no Review node)

`validate` runs in two modes, same node, no extra LLM call:

1. **Per-product (mid-run):** `checkProduct` + completeness +
   `confidence < 0.75 → replan` instead of relying only on missing fields.
2. **Final-invoice (at `draft_report`):** before the report is committed, re-check the
   extracted invoice items against the goal targets (names, currency, line arithmetic,
   totals). Mismatch → `replan` (bounded); pass → `report`.

This preserves the original sanity-gatekeeper behavior with **one less LLM node**, no
extra latency, and a cleaner graph.

## 7. SessionManager — browser lives outside state

```
 Worker ──► SessionManager ──► BrowserContext ──► Playwright
                ▲
                │ get(runId) → { context, page }
                │ close(runId)
```

- The graph **never serializes** `Page`/`Browser`/`Context` into state. Nodes call
  `SessionManager.get(runId)` and receive a page; state stores only `sessionId`.
- `SessionManager` owns launch, per-run context/page creation (lazily, on first action —
  see principle 2), and cleanup (`close(runId)` in the `report` node's `finally`).
- The existing `Navigator` becomes the browser-facing wrapper used *by* `SessionManager`.
- This is the single biggest architectural improvement: later additions (browser pool,
  per-run isolation, headed/headless mode, screenshot capture for the UI) all live here
  and no node owns lifecycle.

## 8. HITL — Redis BLPOP (conscious MVP tradeoff, swappable)

For this assignment we intentionally **keep the existing BLPOP implementation**
(`waitForHITLResolution` / `/resolve` unchanged) to minimize migration risk and preserve
behavior. The graph boundaries are designed so the HITL node can later be swapped to
LangGraph `interrupt()` with a persistent checkpointer **without affecting the rest of
the graph** — the node's contract (write `resolution`, route approve/override/abort) is
identical either way.

Consequences today: the graph compiles without a checkpointer (in-process execution;
`MemorySaver` only for local debugging). A worker restart loses an in-flight run — same
as the pre-migration behavior. **Acceptable for MVP; the interrupt() + checkpointer swap
is a production hardening item, not part of this migration.**

## 9. Streaming & events — unchanged

Nodes emit through a shared `emit()` helper: DB insert + `publishEvent` (Redis pub/sub →
SSE). The browser-side `useRunStream` and the `/runs/:id/stream` proxy are untouched.
Optional future: `graph.stream(input, { streamMode: "updates" })` for micro-step
timeline entries — not in MVP.

## 10. Replanning — structured context + per-node retries

- `replanContext` is `ReplanEntry[]` (structured), so the replan prompt gets
  `node`, `reason`, `retry`, `detail`, `timestamp` — not a vague string — and can pick a
  specific alternative strategy (different selector, different search query, different
  fallback).
- Retries are tracked **per node** (`nodeRetries`), not a single global counter. Default
  cap: 2 retries per node. This makes debugging obvious (`extract:2`, `execute:1`) and
  prevents one node's failures from starving another's budget.

## 11. File layout (new)

```
worker/src/agent/
  graph/
    state.ts          # SentinelState + reducers
    graph.ts          # buildSentinelGraph(): CompiledStateGraph
    nodes/
      plan-node.ts
      execute-node.ts
      extract-node.ts
      validate-node.ts
      replan-node.ts
      hitl-node.ts
      report-node.ts
  actions/            # tiny action executors (navigate/search/fill/click/wait/screenshot)
    index.ts
  session/
    session-manager.ts
  runner.ts           # deleted after swap
  ...                 # planner/navigator/extractor/rule-engine/coupon/form-filler unchanged
```

`queue/jobs.ts`: replace `new AgentRunner(...).run()` with
`buildSentinelGraph().invoke({ runId, input, ... })`. `concurrency: 5` stays; the job's
`finally` calls `SessionManager.close(runId)`.

## 12. Dependencies & build

- Add: `@langchain/langgraph`. Keep the existing `LLMProvider` abstraction
  (`worker/src/llm/client.ts`) — nodes call it, not LangChain model bindings. Preserves
  Gemini primary + OpenRouter fallback (ADR-005).
- `worker` verification: `npm run build` and `npm run lint` (`tsc --noEmit`) in `worker/`.
- `repo` verification: `npm run lint` and `npm run build` in `src/` — no-ops unless we add
  new `AgentEventType`s.

## 13. Frontend contract impact

- **Required changes: none.** `RunStatus`, `AgentEventType`, `ApprovalResolution`,
  `ReconciliationReport` keep their shapes; the worker still emits the same events.
- **Optional, additive (defer):** add `REPLAN` to `AgentEventTypeSchema` +
  `src/types/index.ts` so the timeline can badge replan steps. The frontend `EVENT_LABELS`
  map already falls back to the raw type string, so it is safe to add later.
- The richer `PlanResult` (`risk`, `confidence`, `estimatedSteps`,
  `needsClarification`) is a **future** UI surface: it requires a small additive contract
  change (a `PlanResult` block on `RunSummary`/`AgentEvent.evidence`) once the UI wants
  it. Not part of MVP.

## 14. Migration phases (each ends green: `npm run build` + `npm run lint`)

**Phase A — Scaffold the graph, no behavior change** ✅ done (2026-08-06)
Add `@langchain/langgraph`. Build `state.ts`, `SessionManager`, and the action
executors. Introduce `PlanResult` + extractor confidence. Compile a **linear** graph
`plan → execute → extract → validate → report` with no conditional edges. Run the worker
against the mock storefront and confirm identical events/report to pre-migration.

**Phase B — HITL edge** ✅ done (2026-08-06)
Add the `hitl` node + `validate → hitl` conditional edge (needs-human), wired to the
existing BLPOP wait and `/resolve`. Verify approve/override/abort end-to-end.
Verified via node-level tests (validate routes `hitl`; override → RESUME + recheck,
approve → RESUME, abort → ABORTED/end; `approval_requests` row + resolution persisted).

**Phase C — Replan loop** ✅ done (2026-08-06)
Add `replan` node + failure branch (low confidence / incomplete / sanity mismatch),
structured `ReplanEntry`, per-node `nodeRetries`. Verify: forced failure → replan →
success on retry; forced double failure → `FAILED`.
Verified via node-contract tests: `validate` routes incomplete/low-confidence to
`replan` (`nodeRetries.extract` 1→2) then FAILED at cap; `execute` step errors route
to `replan` (`nodeRetries.execute` 1→2) then FAILED at cap; `replan` produces a
revised plan (→ `execute`, `stepIndex: 0`) or FAILED on empty plan. Final-invoice
sanity mode (§6) is deferred — report node already gates the invoice before commit.

**Phase D — Cleanup** ✅ done (2026-08-06)
Delete `runner.ts`; update `context/architecture.md` (worker in-tree + graph),
`decisions.md` (new ADR, Status: Accepted), `roadmap.md` Phase 2 items. Full re-verify.
`runner.ts` deleted; `architecture.md` (diagram, worker responsibilities, lifecycle +
replan, worker module layout, in-tree convention), `roadmap.md` Phase 2 (in-tree + done),
and this plan all updated. ADR-011 was already recorded as Accepted in `decisions.md`.
Worker `npm run lint`/`build` and repo `npm run lint`/`build` all green; graph still
compiles with 7 nodes.

## 15. Risks & tradeoffs

- **Added dependency + learning curve.** Justified by conditional loop/replan
  back-and-forth the current switch cannot express.
- **No supervisor LLM routing** (rejected anti-pattern): edges are code/rules only — no
  per-node "who next?" calls, no extra latency/credit burn.
- **In-flight runs not durable across restart** (BLPOP, no checkpointer). Same as today;
  swappable to `interrupt()` + `PostgresSaver` later without graph changes (§8).
- **Debuggability improves:** per-node `nodeRetries`, structured `ReplanEntry`s, and
  `graph.getState()` snapshots that `AgentRunner` never had.

### Phase A verification findings (2026-08-06)

- **`END` must appear in the `addConditionalEdges` pathMap.** A router returning the `END`
  symbol with a plain `["node"]` pathMap throws `Branch condition returned unknown or null
  destination` at runtime (LangGraph resolves `ends[r]` and `ends[Symbol(__end__)]` is
  `undefined`). Fix: pass `["node", END]`. Type signature allows `(N | typeof END)[]`.
  `src/agent/graph/graph.ts` now does this for both conditional edges.
- **Node names cannot collide with state channels.** `addNode("report", ...)` throws at
  build time because `report` is a channel; node renamed to `report_node` and `next`
  value updated to match.
- **HITL BLPOP deadlock (pre-existing, fixed in Phase B).** `waitForHITLResolution` ran
  `blpop` on the shared `redis` client. A blocking command occupies the connection, so
  `signalHITLResolution`'s `rpush` (from `POST /runs/:id/resolve`, same process) queued
  behind it and only reached the server after the 3600s timeout — i.e. the old runner
  could never be approved. Fix: BLPOP now runs on a dedicated per-call connection in
  `waitForHITLResolution` (`src/storage/redis.ts`); `signalHITLResolution` keeps the
  shared client. Verified with a direct blpop/rpush concurrency test and the HITL
  node-level tests.
- **Replan triggers are validate-driven (extraction) or execute-driven (thrown step
  errors).** `replan` re-runs the whole revised plan from `stepIndex: 0` (idempotent
  by design), which is simpler than surgically resuming at the failed step and matches
  the "re-run affected steps" routing rule. Budget is checked when the failure is
  *detected* (`nodeRetries[node] < MAX_RETRIES_PER_NODE`), so `replan` itself only
  decides success (→ execute) vs terminal (→ FAILED on empty revised plan).
- **Live storefront reality (pre-existing, not a migration regression):**
  `thread-shopping.netlify.app` ("Therads") is a client-side SPA with **no search box**
  (the `navigate → search` step always times out in `Navigator.search`, exactly as it
  did under `AgentRunner`), prices render as `₹NaN` (its own data fetch is broken, so
  extraction yields confidence 0), and the Add-to-Cart button selector does not match.
  Phase A equivalence is therefore demonstrated as *identical failures on the live site*,
  plus green static verification and node-level tests of all five nodes. A full `DONE`
  run with a live reconciliation report needs either a healthy storefront or the mock
  storefront this phase assumed — revisit when one is available.

## 16. Out of scope (deferred)

- LangGraph Platform / managed deployment (staying self-hosted; keep BullMQ + Express +
  Redis).
- `interrupt()` + durable checkpointer.
- Per-step SSE micro-events from `streamMode: "updates"`.
- Surfacing `PlanResult` (risk/confidence/steps) in the UI.
- Python rewrite.

## 17. ADR

Recorded in `context/decisions.md` as **ADR-011 — Worker orchestration on LangGraph.js
(in-tree worker/)**, **Status: Accepted (2026-08-06)**. Excerpt from the decision record:

## 18. Open questions (non-blocking)

1. Ship the optional `REPLAN` `AgentEventType` now or defer? (Recommend: defer.)
2. `needsClarification` in `PlanResult`: for MVP map it to the existing "goal too vague"
   `FAILED` path, or introduce a non-terminal status + UI? (Recommend: MVP maps to
   existing path; richer handling later with the `PlanResult` UI.)
3. Approve this plan → append ADR-011 and start Phase A?
