# Sentinel — Project Overview

**Name:** Sentinel
**Tagline:** B2B Vendor Order & Discrepancy Reconciliation Agent
**Status:** Active / Production-Ready

## Mission

Sentinel is an AI agent that **executes** B2B procurement workflows across any e-commerce storefront or vendor portal (eBay, Amazon, Flipkart, Target, Best Buy, B&H Photo, SauceDemo, etc.). Given a natural-language goal, it navigates vendor portals, resolves direct search URLs, extracts live market prices, builds carts, fills forms, applies discount codes, and validates every price and coupon against business rules. When a rule is violated — a price variance above threshold, a failed coupon, an inventory surprise — Sentinel **pauses and asks a human** before continuing. It drafts the final invoice summary for review but never places the order itself.

## Problem

Procurement work is repetitive, cross-system, and error-prone:

- Buyers manually navigate portals, compare prices across stores, re-key orders, and reconcile
  invoices line by line.
- Pricing that drifts from a contracted target (e.g. `$4.00/unit`) goes unnoticed until the
  invoice arrives.
- Discount codes silently fail, and "fall back" policies are applied inconsistently.
- Naive automation is risky: an agent that completes orders without guardrails can spend real
  money on a wrong price.

Sentinel fixes this by combining three things: **action** (it does the clicking and typing),
**reasoning** (it checks each step against business rules), and **guardrails** (a human approves
anything high-stakes before it happens).

## Target Users

- B2B buyers and procurement ops who order from vendor storefronts repeatedly.
- Vendor / category managers who need pricing audits across multiple channels.
- Finance/reconciliation teams that need normalized, exportable invoice summaries.

## Core Capabilities (from the walkthrough)

1. **Goal-driven navigation & search** — parse a goal like *"build a cart with 5 units of
   Organic Almond Milk and 10 units of Oat Milk, apply SUMMER20, fill the shipping form"* into
   a step plan; open the portal, search, and land on product pages.
2. **Reason & extract** — read unit price, discounts, shipping, and inventory; compare against
   targets and business rules (e.g. variance vs `$4.00` target).
3. **Human-in-the-loop (HITL) intervention** — when a threshold is crossed, **pause execution**,
   surface the discrepancy, and let the human **Approve & Continue**, **Override Target**, or
   **Abort**.
4. **Cart building & form filling** — add quantities, navigate to checkout, populate shipping
   and order fields.
5. **Coupon validation & graceful recovery** — apply discount codes, detect portal error
   messages (e.g. *"Invalid Code"*), log the failure, and fall back to the approved policy
   (e.g. default wholesale tier) without crashing.
6. **Final draft & structured output** — stop at the final review screen (does **not** place
   the order), extract a normalized itemized invoice summary, and offer a **CSV export**.
7. **Multi-channel pricing audit** — compare price, discount, shipping, and margin across two
   or more stores; flag any variance above a threshold. Large gaps pause for human confirmation
   before inclusion in the report; small gaps proceed automatically.

## Non-Goals (for now)

- Placing or processing real orders or payments — the agent stops at the review/draft screen.
- Acting without guardrails: high-stakes actions always require human approval.
- Building our own web crawler/index — automation runs against the portals the user targets.
- Multi-tenant auth, billing, or a public SaaS portal (until later phases).

## Principles

- **Guardrail-first.** If a step is high-stakes (purchase, price acceptance, policy override),
  pause and ask. When unsure, ask.
- **Explainable.** Every step is recorded as an event with evidence — a live run is a readable
  timeline, not a black box.
- **Recoverable.** Failures (bad coupon, missing field, timeout) are logged and handled via a
  fallback policy; the run continues or aborts cleanly, never silently.
- **Structured output.** The final invoice/report is a normalized, machine-readable contract
  that the UI renders as a table and exports as CSV.
- **Semantic, consistent UI.** shadcn/ui design tokens and components everywhere; no ad-hoc CSS.

## Repo Scope

This repository is the **Next.js frontend** (goal input, live run screen, result screen) plus a
**thin API** that talks to a separate worker service. See `.ai/architecture.md` for the split
and the shared contract, and `.ai/decisions.md` for the decisions behind it.
