# Public-Readiness Hardening Plan

## Goal

Make Sentinel safe, honest, and demonstrably useful when people outside the project try their own
procurement prompts. The goal is not to promise flawless automation on every website. The goal is
to ensure that unsupported, ambiguous, blocked, and failed tasks stop safely, explain what happened,
and offer a useful next action instead of pretending that work succeeded.

This plan is based on an audit of the current Next.js goal intake and the in-tree Playwright worker.
It is a planning document; no behavior is changed by this file.

## Public product promise

Until this plan is complete, Sentinel should be presented as a guarded procurement research and
draft-order agent:

- It can search supported public storefronts, research specific products, compare prices, build a
  draft cart where the storefront permits it, and stop for human approval.
- It never submits a final order or payment.
- It explains when a storefront blocks automation, requires authentication, cannot identify a
  product with enough confidence, or cannot fulfill a request.
- It does not silently choose a vendor, substitute a product, or report an unverified price.

## Current gaps

### 1. Missing pre-run clarification

The current intent gate has only `CONVERSATIONAL`, `CAPABILITY_QUERY`, and `AUTOMATION_TASK`.
A generic goal such as “buy a laptop” is accepted as an automation task and the planner defaults to
an eBay search when no storefront is named. The system does not ask the user which vendor they
intend, nor does it collect other decision-critical details before work starts.

Required behavior:

- Add a first-class `NEEDS_CLARIFICATION` response/state before a worker run is enqueued.
- Ask only for information that is necessary for the current goal.
- Keep the user in the goal screen until all required fields are resolved; do not create a failed
  worker run merely to discover missing information.

Initial clarification rules:

| Goal type | Required information before dispatch | Example question |
| --- | --- | --- |
| Price lookup / comparison | Product identity and storefront or explicit permission to choose one | “Which storefront should I search: eBay, Amazon, Walmart, or a URL?” |
| Add to cart / draft order | Product, quantity, storefront | “How many units should I add, and which storefront should I use?” |
| Checkout draft | The above plus shipping fields required by that storefront | “Please provide the delivery postal code and any required shipping details.” |
| Login-gated portal | URL plus a secure credential handoff or a human browser-login path | “This vendor requires sign-in. Would you like to provide credentials securely or complete login yourself?” |
| Ambiguous product/variant | A selection constraint | “Which model, size, color, or SKU should I use?” |

Never infer a vendor from silence. A product-research mode may offer eBay as a suggested default,
but it must be an explicit user choice.

### 2. Page viability is not checked before extraction

After navigation, the worker can proceed to extraction from any returned HTML. That means a 404,
empty search result, bot challenge, access-denied page, or CAPTCHA may be treated like a product
page and yield misleading fallback data.

Required behavior: add a `page_assessment` checkpoint immediately after every navigation/search
and before product extraction.

The assessment must classify the page into one of these outcomes:

| Outcome | Worker action | User-facing result |
| --- | --- | --- |
| Valid listing or product page | Continue to product resolution | Normal progress |
| No search results | Optionally revise query once; otherwise stop | “No matching product was found” + query/storefront |
| 404 / unavailable | Retry a corrected search route once; otherwise stop | “This page is unavailable (404)” |
| Temporary network / 5xx error | Bounded retry with backoff | “The storefront did not respond after 2 attempts” |
| Access denied / bot challenge / CAPTCHA | Do not loop retries; stop or request human takeover | “The storefront blocked automated access” |
| Login required | Pause for a real credential/human-login handoff | “This storefront requires sign-in” |
| Unexpected page / low confidence | Replan once, then request user help | “I could not verify that this page contains the requested product” |

The raw technical cause should be recorded in the run event evidence, while the UI presents a
plain-language explanation and an appropriate next action.

### 3. Product resolution must precede price extraction

Price extraction from a search listing is not enough. Listings can omit the price, show a range,
show a sponsored product, or contain several similar variants.

Required resolution flow:

1. Identify candidate listing cards and score them against the requested product name, model/SKU,
   variant, and any user constraints.
2. If no candidate is confident enough, ask the user to refine/select; do not click the first item.
3. If a clearly matched listing card has a verifiable price, extract it with source URL and
   confidence evidence.
4. If the listing price is missing, a range, conditional, or low-confidence, click the matched
   product title/image/card link to open the product-detail page. Price text itself is often not
   clickable and must not be assumed to be a navigation target.
5. Re-verify that the detail page matches the requested product, then extract the price.
6. If the price still cannot be verified, stop with `PRICE_UNAVAILABLE`; never use the first
   number found in the page HTML as a price.

### 4. Unsafe cart and checkout behavior

The generic cart action may fall back to the first visible “Add to cart” control when it cannot
identify the intended product. It may also report cart success when the action was skipped. Checkout
selectors and placeholder shipping values are demo-oriented and do not support arbitrary vendors.

Required behavior:

- Remove first-visible-product cart fallback entirely.
- Add an item only when the product identity match is above a defined confidence threshold.
- Verify cart contents after the click: title/SKU, quantity, variant, and line price must match the
selected product.
- Report “Cart update not verified” as an error, not “Cart updated.”
- Do not use placeholder personal/shipping data for real storefronts.
- Treat checkout as a vendor-specific capability; when the required fields or vendor adapter do
  not exist, stop at a safe draft/cart state and explain the limitation.

### 5. Login, MFA, and human handoff are incomplete

The worker can detect a login page, but the existing HITL flow does not provide secure credential
collection or update the active run input. Approving a login-required interruption cannot by itself
supply credentials.

Required behavior:

- Define one secure handoff model before publicizing login support:
  - user completes login in a controlled interactive browser session, or
  - credentials are submitted through a dedicated, encrypted server-side mechanism that is never
    persisted in events, logs, or reports.
- Explicitly recognize MFA, OTP, CAPTCHA, and security-key pages as human-takeover requirements.
- Add a resume protocol that confirms authentication actually succeeded before continuing.
- Until this exists, describe login-gated portals as unsupported rather than promising a credential
  HITL flow.

## Failure model and result panel

Replace generic “extraction failed” outcomes with a structured terminal reason. Suggested codes:

```text
MISSING_STOREFRONT
MISSING_PRODUCT_DETAILS
AMBIGUOUS_PRODUCT_MATCH
NO_RESULTS
PAGE_NOT_FOUND
TEMPORARY_STOREFRONT_ERROR
BOT_CHALLENGE
LOGIN_REQUIRED
MFA_REQUIRED
PRICE_UNAVAILABLE
CART_UPDATE_UNVERIFIED
UNSUPPORTED_CHECKOUT
WORKER_UNAVAILABLE
```

Every terminal result should show:

1. What Sentinel attempted (storefront, sanitized query, and last verified URL).
2. What it observed (for example, no results, HTTP 404, or access challenge).
3. What Sentinel did to recover (for example, one revised-query attempt).
4. Why it stopped.
5. A next action: change storefront, refine product, retry later, provide login through the
supported handoff, or choose an item manually.

Sensitive content must be redacted from events and result screens. Never expose passwords, session
cookies, full shipping addresses, or raw vendor error pages that could contain private data.

## Retry policy

Retries must be specific and bounded, not a generic “try again” loop.

| Failure class | Maximum automatic attempts | Recovery strategy |
| --- | ---: | --- |
| Network timeout / transient 5xx | 2 | Exponential backoff, then terminate with cause |
| Bad or expired search URL / 404 | 1 | Rebuild direct search URL or use storefront search |
| Empty results | 1 | Normalize/revise query; then ask for clarification |
| Low-confidence product match | 1 | Open best verified candidate detail page or ask user |
| Missing listing price | 1 product-detail attempt | Open matched product detail page and re-extract |
| CAPTCHA / access denied / MFA | 0 automated retries | Stop and request human takeover |
| Cart verification failure | 0 blind retries | Stop; do not risk duplicate/wrong cart entries |

Every retry must emit an event containing the attempt number, recovery strategy, and safe failure
reason. A retry must never make the agent silently choose a different product or vendor.

## Architecture work

### Shared contract

- Extend the shared run/intent contract with clarification and structured failure types.
- Add a terminal `BLOCKED` or retain `FAILED` with a mandatory `failureReason`; choose one and
  use it consistently in frontend, worker, storage, and SSE events.
- Add a page-assessment result schema and product-match confidence/evidence schema.
- Validate worker request and response boundaries with Zod. The worker’s `POST /runs` route must
  not trust raw request bodies.

### Frontend

- Render clarification cards/questions on the goal screen and preserve the original goal.
- Show proposed storefront choices and permit a URL override.
- Render terminal reasons, evidence summary, retry history, and next actions on live-run and result
  screens.
- Make “retry” available only where retry is safe and meaningful.
- Do not describe a run as successful until a verified report/draft exists.

### Worker

- Add `page_assessment` after navigation/search.
- Build site-neutral candidate-card selection and detail-page navigation; introduce vendor adapters
  only where durable selectors are needed.
- Ensure extractor fallback never returns an arbitrary first page price as verified product data.
- Verify all cart mutations post-action.
- Build the authentication handoff or reject login-gated tasks before browser execution.
- Preserve the existing bounded replan behavior, but base replans on structured error codes rather
  than opaque error strings.

## Prioritized to-do list

### P0 — required before a public invitation

- [ ] Add `NEEDS_CLARIFICATION` to the intent contract and goal-screen UI.
- [ ] Require storefront selection for price, cart, and purchase-like goals; remove silent eBay
      default for those goals.
- [ ] Add navigation/search page assessment for 404, no-results, access-denied, CAPTCHA, login,
      and temporary errors.
- [ ] Add structured terminal failure codes, timeline evidence, and plain-language result-panel
      explanations.
- [ ] Prevent extraction from invalid/blocked/non-product pages.
- [ ] Remove generic first-visible “Add to cart” behavior and verify cart content before success.
- [ ] Disable/clearly scope unsupported arbitrary-vendor checkout and login claims.
- [ ] Add automated tests for all P0 branches.

### P1 — next reliability layer

- [ ] Add candidate scoring and explicit product-detail-page resolution when listing price is
      missing or ambiguous.
- [ ] Add bounded retry policy with backoff and audit events.
- [ ] Add a secure human-login/MFA handoff and resume protocol.
- [ ] Collect required shipping fields through an explicit, secure flow only for supported vendor
      adapters.
- [ ] Add per-storefront capability metadata (research, cart, coupon, checkout draft, login).

### P2 — scale and polish

- [ ] Add vendor adapters and contract-catalog support for high-value target portals.
- [ ] Add product variant/SKU selection UI and user selection for tied matches.
- [ ] Add delivery, tax, shipping, seller, and substitution policy support where a vendor adapter
      can verify each value.
- [ ] Add anonymous-trial/account-based execution limits from `context/rate-limiting-plan.md`.
- [ ] Add a public status/capability page and a lightweight feedback capture flow.

## Acceptance scenarios

These scenarios must be automated or manually demonstrated before public promotion:

- [ ] “Buy a laptop” asks for a storefront and does not start a worker run.
- [ ] “Find the price of X on eBay” opens the intended search URL and records the query.
- [ ] A 404 search page triggers one safe search recovery, then reports `PAGE_NOT_FOUND` with the
      last URL.
- [ ] A no-results page reports `NO_RESULTS`, not a fabricated price or generic extraction failure.
- [ ] A CAPTCHA/access-denied page reports `BOT_CHALLENGE` with no retry loop.
- [ ] A listing with no reliable price opens the verified matching product detail page before price
      extraction.
- [ ] A low-confidence product match asks the user to choose/refine rather than selecting the first
      result.
- [ ] A missing cart button or mismatched cart item reports `CART_UPDATE_UNVERIFIED`; it never
      shows a successful cart update.
- [ ] A login-required page does not claim that credentials were provided unless the supported
      handoff has completed and authentication is verified.
- [ ] Every terminal run shows cause, recovery attempts, and a next action in the result panel.
- [ ] No event, log, screenshot metadata, or report exposes credentials or other sensitive values.

## Interview and portfolio evidence

The strongest public demonstration is not “it works on every website.” It is showing mature agent
engineering under uncertainty:

- A short screen recording of a successful price lookup with evidence and a human approval gate.
- A second recording of a bot-blocked or no-results task that stops honestly, shows the cause, and
  recommends the next action.
- A concise architecture diagram: intent/clarification → validated worker run → page assessment →
  candidate resolution → guarded action → explainable report.
- Tests that cover edge cases as deliberately as happy paths.
- A public capability matrix that distinguishes supported flows from planned flows.

This framing is more credible to recruiters and founders than an overbroad claim of universal
automation, and it demonstrates the safety, reliability, and product judgment needed for real
agent systems.
