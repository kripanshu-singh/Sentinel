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
- **Design & MCP Skills:** Impeccable Anti-AI-Slop (`.agents/skills/impeccable/`), 21st Dev CLI (`@21st-dev/cli`), `.mcp.json` (`21st`), Stitch MCP Server.
- **Server state:** `@tanstack/react-query` (add via `npm install @tanstack/react-query` when
  first needed — see `context/code_standards.md`).
- **Validation:** `zod` (add via `npm install zod` — schemas live in `src/server/`).

Config facts: `components.json` → style `base-nova`, aliases `@/components`, `@/components/ui`,
`@/lib`, `@/hooks`; `@/*` → `src/*`; `rsc: true` — interactive components need `"use client"`.

## Installed Design Skills & MCP Tooling (How Agents Must Use Them)

### 1. Impeccable Anti-AI-Slop Skill (`.agents/skills/impeccable/`)
Before declaring UI work complete, agents must verify visual quality against anti-AI-slop rules:
- **Mechanical Detector:** `node .agents/skills/impeccable/scripts/detect.mjs --json <path>` — Detects decorative text gradients (`bg-clip-text`), un-ramped font sizes, and over-stimulating blur.
- **Context Generator:** `node .agents/skills/impeccable/scripts/context.mjs --target <path>` — Reads `DESIGN.md` design tokens & material system.
- **Craft Directives:** Avoid AI design tropes (no decorative gradient text, no broadsheet grids without purpose, no warm cream/terracotta defaults unless explicitly requested). Solid brand tokens only.

### 2. 21st Dev CLI & MCP (`@21st-dev/cli` + `.mcp.json`)
Use 21st tools for catalog component discovery, UI variant generation, and deterministic quality checks:
- **Component Search:** `21st search "<query>"`
- **Component Install:** `21st add <author>/<slug>`
- **UI Variant Generation:** `21st generate "<prompt>"`
- **UI Local Review:** `21st review <path>`
- **Brand & UI SVG Logos:** `21st logo "<brand>"`
- **MCP Server Config:** Defined in `.mcp.json` connecting to `https://21st.dev/api/mcp` using `${API_KEY_21ST}`.

### 3. Stitch MCP Tools (Lazy-Loaded)
Agents can invoke lazy-loaded Stitch MCP tools for structured layout generation:
- `generate_screen_from_text` — Create complete UI screens from natural language prompts.
- `generate_variants` — Produce visual variations of existing components.
- `create_design_system` & `apply_design_system` — Generate and enforce theme design tokens.

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

### 1. Landing / marketing (`/`)

Purpose: sell the product to visitors and route them to the console (`/app`). Registered as the
root page in `src/app/page.tsx`.

Layout (centered, `max-w-7xl`, light theme via semantic tokens — **no forced dark mode**):
- **Root wrapper:** `w-full min-h-dvh bg-background text-foreground` (must stay `w-full` —
  the root `layout.tsx` wraps every route in a flex `SidebarProvider` container that
  shrink-wraps children; without `w-full` the page clamps to content width and drifts left).
- **Navbar** (`src/components/landing/nav.tsx`): sticky, `bg-background/70 backdrop-blur-xl`.
  Brand = **logo image from `/public/favicon.svg`** + "Sentinel" wordmark + `OPS` badge. Links:
  How it works, Capabilities, At work, FAQ (no Pricing link). "Watch run" opens the walkthrough
  video; "Launch console" → `/app`.
- **Hero:** headline + subcopy, grid-floor background (`var(--border)`, 64px, `opacity-[0.15]`),
  CTAs (Launch console → `/app`, Watch run), then `RunBoard` (animated live-run mock) and a
  `VendorMarquee` strip.
- **Quick stats:** 4-point grid.
- **How it works** (`#how-it-works`): `PipelineExplorer` stage trace.
- **Capabilities** (`#capabilities`): guardrail principle cards.
- **At work** (`#at-work`): `ScreenshotTabs` product studio.
- **Guardrails vs. ungated:** comparison table.
- **FAQ** (`#faq`): `Faq` accordion.
- **Final CTA:** primary panel → `/app`, `WatchButton`.
- **Footer:** brand mark, "B2B Vendor Order & Discrepancy Reconciliation Agent", attribution.

Design system notes:
- Light theme only — tokens in `:root` (no `dark` class, no theme toggle).
- Subtle shadows use `shadow-border/60` (not black) so they read correctly on light.
- `Reveal` (motion) for scroll-into-view; `font-mono` micro-labels for the ops-console voice.

### 2. Goal Input (`/app`)

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

### 3. Live Run (`/runs/[runId]`)

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

### 4. Result / Report (`/runs/[runId]/result`)

Purpose: show the final draft invoice/report and export it.

- **Summary card:** run outcome (DONE / ABORTED), generated-at time, one-paragraph summary.
- **Best Pick Hero Banner** (for multi-product comparison goals): highlighted card featuring top-ranked product, star rating, review count, price, verdict, and direct clickable product page link.
- **Product Comparison Spec Sheet Matrix** (for multi-product comparison goals): `Table` with columns `Product Name`, `Price`, `Rating & Reviews`, `Key Specifications`, `Recommendation Verdict`. Product titles include direct external links (`ExternalLink`).
- **Reconciliation table** (`Table`): columns `SKU`, `Description`, `Qty`, `Unit price`,
  `Discount`, `Line total`, `Status`. Product descriptions render as direct clickable product page links when `url` is present. Rows flagged by a discrepancy get a `Badge` and a
  `destructive`-tinted status; **human-confirmed flags** are visibly marked (e.g. a "Confirmed"
  `Badge`) per `context/architecture.md` ("flagged items clearly marked as human-confirmed").
- **Multi-channel comparison** (when present): `Table` of `ChannelSnapshot` —
  channel / price / discount / shipping / computed margin / variance. Rows above threshold get
  a `destructive` `Badge`; auto-passed rows need no marking.
- **CSV export** — `Button` "Export CSV" (`DownloadIcon`, `data-icon="inline-start"`). Client
  component; generates the CSV from the report data including product URLs and comparison spec sheets, triggering a browser download. No CSV library needed — hand-roll with proper escaping.
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
