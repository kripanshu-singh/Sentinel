# Sentinel — Guidance for AI Agents

This file tells AI coding agents how to work effectively in this repository. Read it first,
then follow the pointers — **do not guess project context from memory or training data.**

## Context Files — read in this order (they are the source of truth)

The entire project lives in `context/`. Read these before any non-trivial change:

| # | File | What it gives you |
|---|------|-------------------|
| 1 | `context/project_overview.md` | What Sentinel is, who it's for, the core capabilities (the walkthrough), and non-goals. |
| 2 | `context/architecture.md` | **Why** the frontend/worker split exists, the agent state machine, the streaming channels, and where every file belongs. |
| 3 | `context/ui_context.md` | **The most important UI file.** Design system hard rules + the exact spec for the landing page, goal input, live run (incl. the HITL modal), and result screens. |
| 4 | `context/code_standards.md` | **The most important code file.** Non-negotiable rules (no inline CSS, Tailwind + semantic tokens, Zod at boundaries, React Query, composition, server-first) and the verification checklist. |
| 5 | `context/decisions.md` | Every ADR (frontend/worker split, HITL protocol, streaming, LLM, storage, Zod, React Query). Constraints you must respect. |
| 6 | `context/acceptance_criteria.md` | Each feature as checkable `[ ]` criteria — verify against these before reporting done. |
| 7 | `context/prompts.md` | Reusable copy/paste prompts for common tasks (build a screen, add a component, etc.). |
| 8 | `context/roadmap.md` | Current phase and what's planned next. |

Also read `AGENTS.md` at the repo root: it flags that the pinned Next.js **16** has breaking
changes and points to `node_modules/next/dist/docs/`.

## Working Rules

- **Never guess an API for the pinned Next.js / React version.** Check
  `node_modules/next/dist/docs/` or the source before writing framework code.
- **Never guess project specifics** — the `context/` files above are canonical. If a requirement
  conflicts with them or reads multiple ways, ask the user rather than guessing.
- **Prefer existing shadcn components.** Check `npx shadcn@latest info` before adding; add with
  `npx shadcn@latest add <component>` and read `npx shadcn@latest docs <component>` first.
- **Respect the shared domain types** in `src/types/` — they are the contract with the worker
  service. Change them only when the contract changes, and update all consumers.
- **Verify before reporting done.** Run `npm run lint` and `npm run build`, then confirm against
  the relevant `context/acceptance_criteria.md` boxes.
- **Make minimal, focused changes.** Do not refactor unrelated code.
- **Worker work is out of tree.** Unless a change is about the shared contract, worker (Playwright
  + LLM) code belongs in its own repository.

## Standard Workflow

1. Read the `context/*.md` context above (in order).
2. Explore `src/` to find the right home for the change (`context/architecture.md` → module map).
3. Implement per `context/code_standards.md` and `context/ui_context.md`.
4. Run `npm run lint` and `npm run build` (and tests if present).
5. Verify against the matching `context/acceptance_criteria.md` criteria.
6. Report what changed and how it was verified.

## Common Pitfalls to Avoid

- Adding `"use client"` to files that don't need it (or missing it on interactive ones).
- Inline CSS / raw color values / manual dark mode instead of semantic tokens.
- `space-y-*`/`space-x-*` instead of `flex` + `gap-*`; `w-10 h-10` instead of `size-10`.
- Skipping Zod validation at an API/worker boundary.
- Hand-rolled fetch caching instead of React Query; hand-rolled SSE instead of `useRunStream`.
- Importing shadcn components that aren't installed.
- Editing `globals.css` tokens outside the existing token structure.
- Changing domain types in `src/types/` without updating all consumers.
- Committing secrets, or committing at all without being asked.
