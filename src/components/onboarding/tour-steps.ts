import {
  Sparkles,
  NotebookPen,
  Play,
  Gavel,
  BadgeCheck,
  Activity,
  ListChecks,
  Monitor,
  Target,
  AlertTriangle,
  FileDown,
  ArrowUpRight,
  FileText,
  type LucideIcon,
} from "lucide-react";

/**
 * A single onboarding-tour step. Each step anchors a floating tooltip to a DOM
 * element (matched by `targetId`) and carves a spotlight around it; a step with
 * no `targetId` renders as a centered closing modal.
 */
export interface TourStep {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  /** id of the DOM element to spotlight. Omit for a centered closing step. */
  targetId?: string;
  /**
   * When true, the step is skipped if its target never appears on screen (used
   * for conditional regions like the HITL panel or channel comparison table).
   */
  optional?: boolean;
}

/** Route the tour applies to: "home" | "run" | "result". */
export type TourRoute = "home" | "run" | "result";

export const TOURS: Record<TourRoute, TourStep[]> = {
  home: [
    {
      id: "intro",
      icon: Sparkles,
      eyebrow: "Welcome to Sentinel",
      title: "An agent, but you stay in control",
      body: "Sentinel is a B2B procurement agent that searches storefronts, builds carts, and validates prices and coupons. Crucially, it pauses and asks you before anything high-stakes happens. This tour runs you through the one page you'll use to start it.",
      targetId: "tour-subtitle",
    },
    {
      id: "goal",
      icon: NotebookPen,
      eyebrow: "The goal",
      title: "Describe your procurement task",
      body: "Write your goal in plain language — what to buy, how many units, and anything you want. Sentinel parses it into a step-by-step plan.",
      targetId: "tour-goal",
    },
    {
      id: "rules",
      icon: Gavel,
      eyebrow: "Guardrails",
      title: "Business rules keep it in line",
      body: "These are the constraints Sentinel checks against — a target price or subtotal, a variance threshold, a discount code, and what to do if a coupon fails. If a price drifts past the threshold, Sentinel will pause and ask you.",
      targetId: "tour-rules",
      optional: true,
    },
    {
      id: "run",
      icon: Play,
      eyebrow: "Start the run",
      title: "Launch the agent",
      body: "Hit Start run. Sentinel classifies your prompt, spins up its worker, and takes you to a live screen while it works.",
      targetId: "tour-start",
      optional: true,
    },
    {
      id: "done",
      icon: BadgeCheck,
      eyebrow: "You're ready",
      title: "All set",
      body: "Give the goal a try. Sentinel will keep you in the loop with approvals, evidence, and a final draft before anything is placed.",
    },
  ],

  run: [
    {
      id: "intro",
      icon: Activity,
      eyebrow: "Live run",
      title: "Watch Sentinel work",
      body: "This is the live run screen. Sentinel is executing your goal step by step — here's what you're looking at.",
      targetId: "tour-run-progress",
    },
    {
      id: "log",
      icon: ListChecks,
      eyebrow: "Run log",
      title: "The agent's timeline",
      body: "Every action Sentinel takes is recorded here, newest first. You can read exactly what it's doing — navigating, searching, extracting, checking — at every moment.",
      targetId: "tour-run-log",
      optional: true,
    },
    {
      id: "capture",
      icon: Monitor,
      eyebrow: "Live browser",
      title: "See what the agent sees",
      body: "A live snapshot of the browser as Sentinel navigates the storefront, with the current URL — evidence backing up every step in the log.",
      targetId: "tour-run-capture",
      optional: true,
    },
    {
      id: "hitl",
      icon: AlertTriangle,
      eyebrow: "Guardrails",
      title: "Approvals pause the run",
      body: "When a price or coupon drifts past your rules, Sentinel pauses here and asks you to Approve & Continue, override the target, or abort. Nothing high-stakes happens without you.",
      targetId: "tour-run-hitl",
      optional: true,
    },
    {
      id: "result",
      icon: ArrowUpRight,
      eyebrow: "Next",
      title: "Get the report",
      body: "When the run completes, a reconciliation report is waiting for you — the flagged items, the summary, and a CSV you can export.",
      targetId: "tour-run-result",
      optional: true,
    },
    {
      id: "done",
      icon: BadgeCheck,
      eyebrow: "You're set",
      title: "You're in the loop",
      body: "Keep an eye on the log for evidence, and expect a pause only if something needs your sign-off.",
    },
  ],

  result: [
    {
      id: "intro",
      icon: FileText,
      eyebrow: "Result report",
      title: "Your reconciliation report",
      body: "This is the final draft from your run. It reconciles every line item against the review screen — nothing has been placed yet.",
      targetId: "tour-result-hero",
    },
    {
      id: "table",
      icon: ListChecks,
      eyebrow: "Line items",
      title: "Everything in one table",
      body: "Each SKU, its quantity, unit price, discount, and line total — reconciled against the checkout review. Flagged rows carry a warning; confirmed rows note a human approval.",
      targetId: "tour-result-table",
      optional: true,
    },
    {
      id: "discrepancies",
      icon: AlertTriangle,
      eyebrow: "Warnings",
      title: "Discrepancies surfaced",
      body: "Any business-rule deviation is called out here — what was expected, what was found, and by how much.",
      targetId: "tour-result-discrepancies",
      optional: true,
    },
    {
      id: "channels",
      icon: Target,
      eyebrow: "Comparison",
      title: "Per-store comparison",
      body: "When a multi-channel audit ran, each store's price, discount, shipping, and margin are compared side by side.",
      targetId: "tour-result-channels",
      optional: true,
    },
    {
      id: "export",
      icon: FileDown,
      eyebrow: "Export",
      title: "Take it with you",
      body: "Export the report as a CSV file — no library needed, just a clean download of the invoice table.",
      targetId: "tour-result-export",
      optional: true,
    },
    {
      id: "done",
      icon: BadgeCheck,
      eyebrow: "That's it",
      title: "Ready to reconcile",
      body: "Use the report to feed your procurement records. Sentinel did the work; you keep control of what happens next.",
    },
  ],
};