# Sentinel — Reusable Prompts

Copy/paste these prompts when working with AI agents or code generators. Read the linked
`.ai/*.md` files first; the prompts assume you have.

## Build the Goal Input Screen

> Build the goal input screen at `src/app/page.tsx` (and feature components under
> `src/components/goal-input/`) per `.ai/ui_context.md` § "Goal Input" and
> `.ai/code_standards.md`.
> Requirements:
> - Heading "Sentinel" (`font-heading`), one-line `text-muted-foreground` subheading.
> - Goal `Field` + `FieldLabel` + textarea (`FieldControl`); placeholder: "Build a cart with
>   5 units of Organic Almond Milk and 10 units of Oat Milk, apply SUMMER20, and fill the
>   shipping form."
> - Business rules `FieldSet`/`FieldLegend`: target price (`InputGroupAddon` currency), variance
>   threshold % (default 10), discount code, fallback policy (`Select`).
> - Primary CTA `Button` "Start run" with `PlayIcon` (`data-icon="inline-start"`); `Spinner` +
>   `disabled` while submitting.
> - `"use client"` only for the form interactivity. Zod schema lives in `src/server/`; validate
>   before POSTing.
> Add `zod`/`@tanstack/react-query` via `npm install` if not present. Verify: `npm run lint`
> and `npm run build`, then check `.ai/acceptance_criteria.md` → "Goal input".

## Build the Live Run Screen + HITL Modal

> Build the live run screen at `src/app/runs/[runId]/page.tsx` per `.ai/ui_context.md` § "Live
> Run", `.ai/architecture.md` (lifecycle + SSE), and `.ai/code_standards.md`.
> Requirements:
> - Header: run title, live `Badge` for `RunStatus`, elapsed time.
> - Event timeline of `AgentEvent`s (icon/badge per step, `title`, `detail`, timestamp, current
>   step shows `Spinner`, `Separator` between rows).
> - `"use client"` hook `useRunStream` consuming SSE; silent reconnect, `Skeleton` loading,
>   `Alert` on error with retry.
> - HITL: on `ApprovalRequest`, render a `Dialog` with `Title`, `Alert` (destructive) with the
>   warning text, a discrepancy `Table`, and actions **Approve & Continue** (primary),
>   **Override Target** (secondary, opens currency `Field`), **Abort** (destructive ghost).
>   Disable buttons + `Spinner` while a resolution is in flight; do not close early.
> Verify: `npm run lint` + `npm run build`, then `.ai/acceptance_criteria.md` → HITL.

## Build the Result / Report Screen with CSV Export

> Build the result screen at `src/app/runs/[runId]/result/page.tsx` per `.ai/ui_context.md`
> § "Result / Report" and `.ai/code_standards.md`.
> Requirements:
> - Summary card: outcome, generated-at, one-paragraph summary.
> - `Table` of `LineItem`s (SKU, description, qty, unit price, discount, line total, status);
>   discrepancy rows get a `Badge` and human-confirmed flags are visibly marked.
> - Multi-channel comparison `Table` (`ChannelSnapshot`); above-threshold rows get a
>   `destructive` `Badge`.
> - "Export CSV" `Button` with `DownloadIcon` (`data-icon="inline-start"`); hand-rolled CSV with
>   proper escaping (no library needed).
> - `Skeleton` loading, `Empty` when no report. Use React Query keys `["run", runId]`,
>   `["report", runId]`.
> Verify: lint + build, then `.ai/acceptance_criteria.md` → "Final draft & structured output".

## Add a UI Component

> Add the shadcn `<component>` to Sentinel and use it in <location>.
> First run `npx shadcn@latest info` and `npx shadcn@latest docs <component>`, then
> `npx shadcn@latest add <component>`. Compose per `.ai/ui_context.md` (semantic tokens, groups
> for items, `data-icon`, required `Title` for overlays). Do not hand-write the primitive.
> Verify with `npm run lint` + `npm run build`.

## Define a Zod Schema for an API Boundary

> Add a Zod schema in `src/server/` for <endpoint> that validates <input shape> before any
> downstream code runs. Infer the TypeScript type with `z.infer` and keep the shared contract
> in `src/types/`. Follow `.ai/code_standards.md` (Zod at every boundary). On invalid input
> return a structured 400 with field errors, never raw internals. Verify with lint + build.

## Implement an API Route (frontend → worker proxy)

> Implement the thin API route in `src/server/` that proxies <action> to the worker service.
> Validate the request and the worker's response with Zod (per `.ai/code_standards.md`), keep
> the worker client behind an interface for mocking, and never put worker credentials in the
> browser bundle. Streaming goes over SSE via the `useRunStream` hook on the client. Verify
> with `npm run lint` + `npm run build`.

## Debug a UI / Hydration / Streaming Issue

> Investigate <issue> in the Next.js app. Check the dev-server log and browser console. If it's
> an SSE reconnect causing a lost event, fix `useRunStream` to re-join without duplicating or
> dropping events. If it's a hydration mismatch, find the root cause and fix minimally per
> `.ai/code_standards.md`. Verify with `npm run build`.
