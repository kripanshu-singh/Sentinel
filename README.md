# Sentinel — B2B Vendor Order & Discrepancy Reconciliation Agent

Sentinel is an AI agent that **executes** B2B procurement workflows: it navigates storefronts,
builds carts, fills order/invoice forms, validates pricing and coupons against business rules,
and **pauses for human approval before any high-stakes action**. It drafts the final invoice
summary for review (it never places the order itself).

This repository is the **Next.js frontend**: goal input, live run screen (with a human-in-the-loop
approval modal), result screen with a reconciliation table and CSV export, and a thin
Zod-validated API layer that talks to a separate worker service (Playwright + LLM orchestration).

## Project context — read `.ai/` first

The project's source of truth lives in the `.ai/` folder:

| File | Purpose |
|------|---------|
| `.ai/project_overview.md` | What Sentinel is, who it's for, and why. |
| `.ai/architecture.md` | **Why** the frontend/worker split exists, the agent lifecycle, and module map. |
| `.ai/ui_context.md` | **Most important UI file** — design system + every screen spec. |
| `.ai/code_standards.md` | **Most important code file** — rules for generated code (no inline CSS, Zod, React Query, composition, server-first). |
| `.ai/decisions.md` | Architecture/product decision log (ADRs). |
| `.ai/acceptance_criteria.md` | Every feature as checkable acceptance criteria. |
| `.ai/prompts.md` | Reusable prompts for common tasks. |
| `.ai/roadmap.md` | Current phase and plans. |

## Stack

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, TypeScript (strict), Tailwind v4,
  shadcn/ui (base-nova).
- **Server state / validation:** `@tanstack/react-query` and `zod` (add on first use — see
  `.ai/code_standards.md`).
- **Worker (separate repo):** Node.js + Playwright, LLM orchestration (Gemini 2.5 Flash primary,
  OpenRouter/Groq/Ollama fallback), PostgreSQL (Supabase/Neon), Redis (Upstash/Redis Cloud).

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev     # dev server (re-adds the Next.js agent-rules block to AGENTS.md)
npm run build   # production build + type-check
npm run start   # serve production build
npm run lint    # eslint
```

## Verification

Before reporting any change done, run `npm run lint` and `npm run build` and check the matching
criteria in `.ai/acceptance_criteria.md`. Never commit unless asked.
