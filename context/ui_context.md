# Sentinel — UI Context (MOST IMPORTANT UI FILE)

This file is the **source of truth for all UI work** in this repo. Read it before touching any
component, page, or style. It defines the design system and the exact spec for every screen.
If this file and the code disagree, this file wins — fix the code.

## Stack (installed facts — do not contradict)

- **Framework:** Next.js 16 (App Router, Turbopack), React 19.
- **Styling:** Tailwind CSS v4 (CSS-first config in `src/app/globals.css`).
- **Primitives:** shadcn/ui **base-nova** style, Base UI primitives.
- **Icons:** `lucide-react`.
- **Fonts:** Geist (`--font-geist-sans`, `--font-geist-mono`) via `next/font/google`.
- **Server state:** `@tanstack/react-query` (add via `npm install @tanstack/react-query` when
  first needed — see `.ai/code_standards.md`).
- **Validation:** `zod` (add via `npm install zod` — schemas live in `src/server/`).

Config facts: `components.json` → style `base-nova`, aliases `@/components`, `@/components/ui`,
`@/lib`, `@/hooks`; `@/*` → `src/*`; `rsc: true` — interactive components need `"use client"`.

## Design System Rules (hard rules, no exceptions)

- **Semantic tokens only.** `bg-background`, `text-muted-foreground`, `bg-primary`,
  `text-destructive`, `border-border`, … Never raw hex/arbitrary Tailwind colors
  (`bg-zinc-50`, `text-[#123456]`, `dark:bg-black`).
- **No inline CSS.** No `style={{...}}` attributes, no `<style>` tags, no CSS files other than
  `globals.css`. Styling is Tailwind utility classes only.
- **Layout with `flex` + `gap-*`.** Never `space-x-*` / `space-y-*`.
- **Equal w/h → `size-*`.** e.g. `size-10`, never `w-10 h-10`.
- **`truncate`** for single-line ellipsis; never manual `…` hacks.
- **No manual `dark:` overrides.** Dark mode comes from tokens.
- **`cn()`** for conditional classes; never template-literal ternaries inside `className`.
- **Overlays (Dialog/Sheet/Popover) manage their own stacking** — never set `z-index`.
- **Semantic typography.** Use `font-heading` for headings, existing `text-*` scale, no
  arbitrary font-size classes.
- **No dead imports.** Every import is used; lint enforces this.

## Component Conventions (base-nova / shadcn)

- **Forms:** `FieldGroup` + `Field` (`FieldLabel`, `FieldDescription`, `FieldControl`). Never a
  raw `div`-based form layout.
- **Input groups:** `InputGroup` + `InputGroupInput` / `InputGroupAddon`.
- **Option sets (2–7):** `ToggleGroup`. Grouped checkboxes/radios: `FieldSet` + `FieldLegend`.
- **Validation state:** `data-invalid` on `Field`, `aria-invalid` on the control. Error text is
  `FieldDescription` with `text-destructive`.
- **Items inside groups:** `SelectItem` → `SelectGroup`, `DropdownMenuItem` →
  `DropdownMenuGroup`, `CommandItem` → `CommandGroup`.
- **Dialog/Sheet/Drawer always need a `Title`** (`sr-only` if hidden) for a11y.
- **Button loading:** compose `Spinner` + `data-icon` + `disabled` — there is no `isLoading`
  prop.
- **Button icons:** pass icons as objects (`icon={CheckIcon}`) with `data-icon="inline-start"`.
  No sizing classes on icons inside components.
- **Use existing components:** `Alert` for callouts, `Empty` for empty states, `Skeleton` for
  loading, `Badge` for status labels, `Separator` instead of `<hr>`, `Table` for data.

## Screens (product spec)

### 1. Goal Input (`/app` and `/`)

Purpose: the user types a procurement goal and sets business rules before a run starts.

Layout (Single-Page Application SPA centered layout, `max-w-2xl`):
- **Teal Radial Background Glow:** `#6bd8cb` radial gradient centered at top of canvas.
- **Heading** (`font-heading`, `text-3xl`): "Sentinel".
- **Subheading** (`text-muted-foreground`): B2B vendor order & discrepancy reconciliation tagline.
- **Goal textarea** — `textarea` with ambient gradient blur focus ring.
  Placeholder: *"Search for Sony WH-1000XM5 headphones on Amazon and extract the price. Or: Check if boAt headphones on Flipkart are under ₹1,500."*
- **Business rules fieldset** — grouped `FieldSet` containing:
  - Target unit price (`Input` with `InputGroupAddon` `$`)
  - Target subtotal (`Input` with `InputGroupAddon` `$`)
  - Variance threshold (%) (`Input`, default `10`)
  - Discount code (`Input`)
  - Fallback policy (`Select`: "Default wholesale tier", "Best available code", "Abort")
  - Optional portal credentials toggle (Username / Password inputs)
- **Suggested Workflows** — 3 real-world e-commerce preset cards:
  1. 🛡️ **eBay — Sony WH-1000XM5 Price Audit** ($250 ceiling, triggers live HITL panel)
  2. 🛒 **Flipkart — boAt Headphone Audit** (INR `₹` currency verification)
  3. ⚡ **Amazon — Logitech Tech Search** ($20 target budget)
- **Primary CTA** — `Button` "Start run" with `PlayIcon`.
  Disabled while submitting. Client component; validates with Zod schema before POSTing.

### 2. Live Run (`/runs/[runId]`)

Purpose: show the agent working in real time, and pause for human approval when needed.

- **Header row:** run title, live status `Badge` (from `RunStatus`), elapsed time.
- **Event timeline** — a vertical list of `AgentEvent` rows, newest-first. Each row:
  `Badge`/icon for the step (`NAVIGATE | SEARCH | EXTRACT | CHECK | HITL | FORM_FILL |
  VALIDATE | RECOVER | DRAFT | STEER`), a `title`, a `detail`, and a timestamp (`text-muted-foreground`,
  `text-sm`). Use `Separator` between rows. The currently executing step shows a `Spinner`.
  Terminal states get a status `Badge` (success/destructive/secondary).
- **Steering control** — an **always-visible** (not gated on HITL) control on the live run
  screen, independent of the approval modal (ADR-012). It lets the operator redirect the agent
  at any time. It contains a `Field`+`FieldLabel` textarea ("Steer the agent") + a `FieldDescription`
  explaining the instruction takes effect at the next step boundary, and a primary `Button`
  "Send instruction" with `SendIcon`/`data-icon="inline-start"`. While sending, show a `Spinner`
  and `disabled`. On success, clear the field and show a transient confirmation (e.g. a `Badge`
  or `Alert`:"Sent — Sentinel will apply this at its next step"). On error, show a
  `destructive` alert with retry. Disable the whole control when the run is terminal
  (`DONE`/`FAILED`/`ABORTED`). This is a `"use client"` control. When a `STEER` event arrives
  on the timeline via SSE, it renders as an acknowledged step row.
- **Streaming:** a `"use client"` hook (`useRunStream`) subscribes via SSE and appends events.
  Handle reconnect silently; never flicker or lose the timeline. Loading state = `Skeleton`
  rows. Error state = `Alert` with retry.
- **HITL modal (the critical interaction):** when an `ApprovalRequest` event arrives, render a
  `Dialog` (always with a `Title`). Contents, in order:
  1. `Alert` with `destructive`-themed icon: the warning title, e.g. *"Price variance: $4.80
     exceeds target $4.00 (+20%)."*
  2. The `Discrepancy` details as a compact `Table` (expected / actual / variance% / threshold).
  3. Buttons, right-aligned in a `DialogActions`-style footer:
     - **"Approve & Continue"** — primary `Button`.
     - **"Override Target"** — secondary `Button`; opens an inline `Field` (currency input)
       to enter a new target, then submits the override.
     - **"Abort"** — destructive ghost `Button`.
  While awaiting the worker's acknowledgement of a resolution, buttons are `disabled` and the
  modal shows a `Spinner`. Do not close the Dialog until the run resumes or aborts.

### 3. Result / Report (`/runs/[runId]/result`)

Purpose: show the final draft invoice/report and export it.

- **Summary card:** run outcome (DONE / ABORTED), generated-at time, one-paragraph summary.
- **Reconciliation table** (`Table`): columns `SKU`, `Description`, `Qty`, `Unit price`,
  `Discount`, `Line total`, `Status`. Rows flagged by a discrepancy get a `Badge` and a
  `destructive`-tinted status; **human-confirmed flags** are visibly marked (e.g. a "Confirmed"
  `Badge`) per `.ai/architecture.md` ("flagged items clearly marked as human-confirmed").
- **Multi-channel comparison** (when present): `Table` of `ChannelSnapshot` —
  channel / price / discount / shipping / computed margin / variance. Rows above threshold get
  a `destructive` `Badge`; auto-passed rows need no marking.
- **CSV export** — `Button` "Export CSV" (`DownloadIcon`, `data-icon="inline-start"`). Client
  component; generates the CSV from the report data and triggers a browser download. No CSV
  library needed — hand-roll with proper escaping.
- **Empty/loading:** `Skeleton` rows while fetching; `Empty` if no report.

## Data & State Patterns

- **React Query** for server state: `useQuery` for run summary / report; `useMutation` for
  starting a run, submitting HITL resolution, CSV export. Keys: `["run", runId]`,
  `["report", runId]`, `["runs"]`.
- **`useRunStream`** (custom hook) for SSE live events. Only the timeline subscribes.
- **React Query** for server state: `useQuery` for run summary / report; `useMutation` for
  starting a run, submitting HITL resolution, **sending a steer**, CSV export. Keys: `["run", runId]`,
  `["report", runId]`, `["runs"]`.
- **Composition over props-drilling:** screens compose feature components; shared bits live in
  `src/components/`. Feature code owns its own data hooks.
- **Loading/empty/error are first-class:** every data-backed view implements all three.

## Checking / Adding Components

- List installed: `npx shadcn@latest info`.
- Docs: `npx shadcn@latest docs <component>` before writing component code.
- Add: `npx shadcn@latest add <component>`.
- Only use components that are installed. Never hand-write a shadcn primitive.
