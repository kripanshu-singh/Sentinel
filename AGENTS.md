<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Sentinel — B2B Vendor Order & Discrepancy Reconciliation Agent

Sentinel is an AI agent that executes B2B procurement workflows: it navigates storefronts, builds carts, fills order/invoice forms, validates pricing and coupons against business rules, and **pauses for human approval before any high-stakes action**. This repo is the **Next.js frontend** (goal input, live run screen, result screen, thin API). The automation worker (Playwright + LLM orchestration) is a separate service; this repo defines the shared contract for it.

## Mandatory context — read the `context/` folder first

Before any non-trivial change, read these in order. They are the source of truth.

| # | File | What it tells you |
|---|------|-------------------|
| 1 | `context/project_overview.md` | What Sentinel is, who it is for, and why it exists. |
| 2 | `context/architecture.md` | **Why** the frontend/worker split exists and where code belongs. |
| 3 | `context/ui_context.md` | **Most important UI file.** Design system + every screen spec. |
| 4 | `context/code_standards.md` | **Most important code file.** Rules that govern generated code. |
| 5 | `context/decisions.md` | Every architecture/product decision (ADRs). Constraints you must respect. |
| 6 | `context/acceptance_criteria.md` | Each requirement as a checkable acceptance criterion. |
| 7 | `context/prompts.md` | Reusable prompts for common tasks. |
| 8 | `context/roadmap.md` | Current phase and what is planned. |

The above Next.js block applies to every change in `src/`.

## Non-negotiables (full detail in `context/code_standards.md`)

- **No inline CSS.** Tailwind only, semantic tokens only (`bg-background`, `text-muted-foreground`, …).
- **Zod validation** at every API boundary — never trust raw input.
- **React Query** for server state; composition over props-drilling.
- **Server-first.** Server Components by default; `"use client"` only for interactivity.
- Verify before reporting done: `npm run lint` and `npm run build`.
- **Anti-AI-Slop & Design Skills:** Run `node .agents/skills/impeccable/scripts/detect.mjs --json <path>` to audit visual craft. Use `21st` CLI (`21st search`, `21st review`, `21st generate`) and Stitch MCP tools (`generate_screen_from_text`, `create_design_system`) for component & UI generation (see `context/ui_context.md`).
- Never commit secrets, and never commit at all unless asked.

## Standard workflow

1. Read the `context/*.md` context above.
2. Explore `src/` to find the right home for the change (see `context/architecture.md`).
3. Implement per `context/code_standards.md` and `context/ui_context.md`.
4. Run `npm run lint` and `npm run build`.
5. Report what changed and how it was verified.
