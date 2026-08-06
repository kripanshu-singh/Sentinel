# Sentinel — Code Standards (MOST IMPORTANT CODE FILE)

This file is the **source of truth for generated code**. Every line you write in this repo must
satisfy these rules. Lint + build are the gatekeepers; these rules are the reason they exist.
If a requirement is ambiguous, re-read this file, then `.ai/ui_context.md`, then ask.

## Non-Negotiables

- **No inline CSS. Ever.** No `style={{…}}`, no `<style>`, no bespoke CSS files. Tailwind
  utility classes with **semantic tokens only** (`bg-background`, `text-muted-foreground`, …).
  See `.ai/ui_context.md` for the full list.
- **Zod validation at every boundary.** Never trust raw input. Every API route, server action,
  and worker-response boundary validates with a Zod schema in `src/server/`. Infer types from
  schemas with `z.infer`.
- **React Query for server state.** No hand-rolled `useEffect` + `fetch` caching. Use
  `useQuery` / `useMutation` with stable keys. Custom hooks own the data.
- **Composition over props-drilling.** Build small components and compose them. Pass props one
  level, not five. Feature components own their data hooks.
- **Server-first.** Server Components by default. `"use client"` only for interactivity
  (SSE, modals, interactive tables). Never add it "just in case".
- **TypeScript strict.** `tsconfig.json` is strict. No `any` unless unavoidable and commented
  as such.
- **No comments unless asked.** Code must be self-documenting through names and structure.
- **Never commit secrets.** API keys, LLM credentials, DB URLs live in env only, never in code
  or commits. Never commit at all unless explicitly asked.

## Tooling & Verification

- Run before reporting done: `npm run lint` and `npm run build` (build includes type-checking).
- Next.js 16 has breaking changes vs. your training data — consult
  `node_modules/next/dist/docs/` before writing framework code. Heed deprecation notices.
- Dependencies to add when first needed (not yet installed): `zod`,
  `@tanstack/react-query`. Do not invent other libraries without checking they're needed.

## Style

- Mirror patterns from neighboring files. Match their structure and naming.
- Small, explicit functions over clever one-liners. Meaningful names.
- Use `cn()` from `@/lib/utils` for conditional classes — never template-literal ternaries.
- No dead imports; lint enforces it.

## Styling Rules (Tailwind)

- Semantic tokens only; no raw hex/arbitrary values when a token exists.
- `flex` + `gap-*`, never `space-x-*`/`space-y-*`.
- `size-*` for equal width/height.
- No `dark:` overrides. No `z-index`. No manual ellipsis — use `truncate`.
- `font-heading` for headings. Keep edits to `src/app/globals.css` inside the token structure;
  never add a second CSS file.

## Structure

```
src/
  app/            # pages: / (goal input), /runs/[runId] (live), /runs/[runId]/result
  components/     # shadcn/ui + feature components (goal-input/, run/, hitl/, report/)
    ui/           # shadcn generated — do not hand-edit
  hooks/          # useRunStream, useResolveHITL, react-query hooks
  lib/            # utils, api clients, format helpers
  server/         # server-only: API routes, Zod schemas, worker proxy
  types/          # shared domain contract (see .ai/architecture.md)
```

- Shared domain types (`GoalInput`, `AgentEvent`, `ApprovalRequest`, `ReconciliationReport`,
  …) live in `src/types/` and are the contract with the worker. Changing them is a cross-service
  change — update every consumer and the worker's mapping.
- External integrations (worker proxy, CSV) go behind interfaces in `src/server/` so they can be
  mocked.

## Verification Checklist (run this before you say "done")

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes (includes type-checking).
- [ ] No `style={{…}}`, no raw colors, no `space-x/y-*`, no `dark:` overrides, no dead imports.
- [ ] Every API/worker boundary validates with Zod; no `any` slipping through.
- [ ] Server Components by default; `"use client"` only where required.
- [ ] React Query for server state; SSE via `useRunStream` where applicable.
- [ ] New/changed behavior verified locally (or has tests if the project gains a runner).
- [ ] No secrets or credentials introduced.
