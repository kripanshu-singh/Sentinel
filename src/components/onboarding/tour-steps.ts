import {
  Sparkles,
  NotebookPen,
  Play,
  Gavel,
  ShieldCheck,
  BadgeCheck,
  type LucideIcon,
} from "lucide-react";

/**
 * Config for the first-time-user onboarding tour on the goal input
 * (home) page. Each step anchors a floating tooltip to a target element on the
 * page (matched by `targetId`) and carves a spotlight around it; the closing
 * step has no target and renders as a centered modal.
 */
export interface TourStep {
  id: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  /** id of the DOM element to spotlight. Omit for a centered closing step. */
  targetId?: string;
  /** Preferred tooltip placement relative to the target. */
  placement?: "top" | "bottom" | "left" | "right";
}

export const HOME_TOUR: TourStep[] = [
  {
    id: "intro",
    icon: Sparkles,
    eyebrow: "Welcome to Sentinel",
    title: "An agent, but you stay in control",
    body: "Sentinel is a B2B procurement agent that searches storefronts, builds carts, and validates prices and coupons. Crucially, it pauses and asks you before anything high-stakes happens. This tour runs you through the one page you'll use to start it.",
    targetId: "tour-subtitle",
    placement: "bottom",
  },
  {
    id: "goal",
    icon: NotebookPen,
    eyebrow: "The goal",
    title: "Describe your procurement task",
    body: "Write your goal in plain language — what to buy, how many units, and anything you want. Sentinel parses it into a step-by-step plan.",
    targetId: "tour-goal",
    placement: "bottom",
  },
  {
    id: "run",
    icon: Play,
    eyebrow: "Start the run",
    title: "Launch the agent",
    body: "Ship start. Sentinel classifies your prompt, spins up its worker, and starts the run. You'll be taken to a live screen as it works.",
    targetId: "tour-start",
    placement: "bottom",
  },
  {
    id: "rules",
    icon: Gavel,
    eyebrow: "Guardrails",
    title: "Business rules keep it in line",
    body: "These are the constraints Sentinel checks against — a target price or subtotal, a variance threshold, a discount code, and what to do if a coupon fails. If a price drifts past the threshold, Sentinel will pause and ask you.",
    targetId: "tour-rules",
    placement: "top",
  },
  {
    id: "quickstart",
    icon: ShieldCheck,
    eyebrow: "Quick start",
    title: "Try a suggested workflow",
    body: "Not sure what to type? These presets pre-fill a proven goal and its rules — pick one, tweak it, and hit Start run.",
    targetId: "tour-quickstart",
  },
  {
    id: "done",
    icon: BadgeCheck,
    eyebrow: "You're ready",
    title: "All set",
    body: "Give the goal a try. Sentinel will keep you in the loop with approvals, evidence, and a final draft before anything is placed.",
  },
];