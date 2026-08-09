# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- B2B buyers and procurement ops who repeatedly order products from vendor storefronts.
- Category managers who need pricing audits across multiple storefront channels (Amazon, eBay, B&H, Target, SauceDemo).
- Finance and reconciliation teams requiring normalized, line-item itemized invoice summaries.

## Product Purpose

Sentinel is an AI agent that executes B2B procurement workflows. Given a natural-language goal, it navigates vendor portals, extracts unit pricing, tests discount promo codes against contract rules, and pauses for human approval whenever a price variance or policy exception is detected.

## Positioning

Autonomous procurement execution with 100% human-in-the-loop (HITL) guardrails. Unlike un-gated AI scripts that risk spending real money on wrong storefront prices, Sentinel pauses execution before high-stakes actions to guarantee zero unapproved spend.

## Operating Context

- Web storefronts and vendor portals (Amazon Business, eBay Enterprise, B&H, SauceDemo, custom web stores).
- Playwright-driven browser automation worker streaming SSE execution timeline events to Next.js frontend.
- Blocking HITL approval dialogs surfacing discrepancy metrics (Approve, Override Target, Abort).
- Itemized reconciliation report tables with one-click CSV export.

## Capabilities and Constraints

- **Goal-Driven Navigation**: Translates plain-English procurement instructions into multi-step browser actions.
- **Price Variance Guardrails**: Validates unit costs against configured target ceilings and tolerance thresholds.
- **Coupon Validation & Recovery**: Tests promo codes, logs portal error messages, and applies fallback wholesale policies.
- **Real-Time HITL Interceptor**: Pauses execution and surfaces discrepancy breakdowns for human sign-off.
- **Constraint**: Sentinel stops at the final order draft/review screen and does **not** complete real financial payments or place live order submissions.

## Brand Commitments

- Name: **Sentinel**
- Voice: Authoritative, precise, transparent, and hyper-efficient.
- Color Identity: Deep Teal primary accent (`#00685f` / `#6bd8cb`), obsidian glass dark mode, high legibility typography (`Geist` / `Geist Mono`).

## Evidence on Hand

- Walkthrough walkthrough video modal and real application screenshot assets (`scrn1.webp`, `scrn2.webp`, `scrn3.webp`).
- Real-world storefront test scenarios (Dell UltraSharp Monitors, Organic Oat Milk supplies, boAt headphones).

## Product Principles

1. **Guardrail-First**: If a step is high-stakes (price acceptance, policy override, purchase draft), pause and ask human operator.
2. **Explainable**: Every agent decision and Playwright DOM click is recorded in a real-time event timeline.
3. **Recoverable**: Failures (expired codes, missing DOM fields) trigger configured fallback policies without crashing.
4. **Structured Output**: Final reconciliation reports are normalized contracts exportable to CSV.
