# Sentinel — Acceptance Criteria

Every requirement is a checkable acceptance criterion. Use the template below for new
features; existing criteria below map directly to `.ai/project_overview.md` capabilities and
the walkthrough. Mark a box `[x]` only when verified.

## Definition of Done (applies to every feature)

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes (includes type-checking).
- [ ] UI follows `.ai/ui_context.md` — semantic tokens, shadcn components, no inline CSS.
- [ ] Code follows `.ai/code_standards.md` — Zod at boundaries, React Query, server-first.
- [ ] No secrets or credentials introduced.
- [ ] Behavior verified locally (manual or automated).

## Template

```
Feature: <name>
As a: <user role>
I want: <capability>
So that: <outcome>

AC-1. Given <condition>, when <action>, then <observable result>.
AC-2. ...
AC-N. Non-functional: <constraint>.
```

## Feature: Goal input (`/`)

- [ ] AC-1. Given a user on `/`, when the page renders, then the heading shows "Sentinel" and
      a one-line subheading about the B2B reconciliation agent.
- [ ] AC-2. Given the goal form, when the user types a natural-language goal, then the goal is
      captured and sent to the API with the configured business rules (target price, variance
      threshold, coupon code, fallback policy).
- [ ] AC-3. Given an invalid goal (empty / over max length), when submitted, then validation
      errors show inline (`aria-invalid` on the control) and no run is created.
- [ ] AC-4. Given valid input, when the user clicks "Start run", then a run is created and the
      user is routed to `/runs/[runId]`.
- [ ] AC-5. Non-functional: the form submits via Zod-validated API; button shows a `Spinner`
      and is `disabled` while submitting.

## Feature: Navigation & search

- [ ] AC-1. Given a started run, when the agent begins, then a `NAVIGATE` event opens the
      portal/storefront.
- [ ] AC-2. Given a search goal (e.g. "Organic Almond Milk"), when the agent searches, then a
      `SEARCH` event is emitted and the correct product page is reached.
- [ ] AC-3. Given a product page, when the agent extracts the page, then an `EXTRACT` event
      records unit price, discount, shipping, and inventory as evidence.

## Feature: Price / discrepancy detection

- [ ] AC-1. Given a target price (e.g. `$4.00`) and threshold (e.g. `10%`), when a product is
      found at `$4.80`, then a `Discrepancy` of `+20%` is computed and `CHECKING` evaluates it
      against the threshold.
- [ ] AC-2. Given a variance **above** threshold, when checked, then the run transitions to
      `HITL_PENDING` and emits an `ApprovalRequest`.
- [ ] AC-3. Given a variance **at or below** threshold, when checked, then the run proceeds
      automatically with **no** HITL interruption.

## Feature: Human-in-the-loop intervention

- [ ] AC-1. Given an `ApprovalRequest`, when the live run screen receives it, then a `Dialog`
      shows an `Alert` with the warning (e.g. "Price variance: $4.80 exceeds target $4.00
      (+20%).") plus a discrepancy table.
- [ ] AC-2. Given the modal, when the user clicks **Approve & Continue**, then the resolution
      is sent, the run resumes, and the approval is recorded.
- [ ] AC-3. Given the modal, when the user clicks **Override Target** and enters a new target,
      then the run recomputes against the override and re-enters `CHECKING`.
- [ ] AC-4. Given the modal, when the user clicks **Abort**, then the run transitions to
      `ABORTED`, the modal closes, and the abort reason is logged.
- [ ] AC-5. Given a resolution in flight, when the UI is waiting on the worker, then the
      buttons are `disabled` and a `Spinner` is shown; the modal does not close early.
- [ ] AC-6. Non-functional: an unhandled timeout in `HITL_PENDING` is surfaced as an `Alert`
      with a retry, never a silent hang.

## Feature: Cart building & form filling

- [ ] AC-1. Given an approved price, when the agent adds quantities (e.g. 5 × Almond Milk, 10 ×
      Oat Milk), then a `FORM_FILL` event records the cart action and the run navigates to
      checkout.
- [ ] AC-2. Given the shipping form, when the agent populates address/order fields, then each
      field fill is logged with evidence.

## Feature: Coupon validation & graceful recovery

- [ ] AC-1. Given a coupon (e.g. `SUMMER20`), when applied, then a `VALIDATE` event checks the
      portal response for success or error text (e.g. "Invalid Code").
- [ ] AC-2. Given a failed coupon, when detected, then the failure is logged and the run applies
      the configured fallback policy (e.g. default wholesale tier) via `RECOVERING`.
- [ ] AC-3. Given a successful coupon, when applied, then the discounted line totals are
      reflected in the final report.
- [ ] AC-4. Given a business-rule failure, when recovery is possible, then the run continues
      and **never** crashes on a validation error.

## Feature: Final draft & structured output

- [ ] AC-1. Given a run reaching the review screen, when the agent stops, then the run is
      `DRAFT_READY`/`DONE` and the order is **not** placed.
- [ ] AC-2. Given a finished run, when the result screen loads, then a `Table` shows a
      normalized itemized invoice (SKU, description, qty, unit price, discounts, line total,
      status).
- [ ] AC-3. Given flagged discrepancies, when rendered, then flagged rows carry a `Badge` and
      human-confirmed flags are visibly marked as confirmed.
- [ ] AC-4. Given the result screen, when the user clicks **Export CSV**, then a CSV file of
      the invoice table downloads with proper escaping.
- [ ] AC-5. Non-functional: result screen shows `Skeleton` while loading and `Empty` when no
      report exists.

## Feature: Multi-channel pricing audit

- [ ] AC-1. Given two store URLs, when the agent visits both, then a `ChannelSnapshot`
      (price, discount, shipping, computed margin) is extracted per channel.
- [ ] AC-2. Given a variance above the margin threshold (e.g. 15%), when computed, then the
      item pauses for human confirmation before inclusion in the final report.
- [ ] AC-3. Given a small variance, when computed, then the item proceeds automatically and is
      included without interruption.
- [ ] AC-4. Given a completed audit, when rendered, then a comparison `Table` (channel / price /
      discount / margin / variance) plus a one-paragraph summary are shown, with flagged items
      marked as human-confirmed.

## Feature: Shared contract (types + events)

- [ ] AC-1. Given a `RunStatus` or `AgentEvent`, when serialized over SSE/HTTP, then both
      frontend and worker agree on shape (single source of truth in `src/types/`).
- [ ] AC-2. Given a worker response, when received by the frontend API, then it is validated
      with Zod before reaching any component.
