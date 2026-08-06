import test from "node:test";
import assert from "node:assert/strict";
import { getFallbackPlan } from "./planner.js";
import type { GoalInput } from "../types/index.js";

test("creates a fallback plan for simple shopping requests", () => {
  const input: GoalInput = {
    goal: "add the red t-shirt under $20",
    varianceThresholdPct: 10,
    fallbackPolicy: "default_wholesale",
  };

  const plan = getFallbackPlan(input);

  assert.ok(plan, "expected a fallback plan");
  assert.equal(plan?.needsClarification, false);
  assert.equal(plan?.plan[0]?.kind, "navigate");
  assert.equal(plan?.plan[1]?.kind, "search");
  assert.equal(plan?.plan[plan.plan.length - 1]?.kind, "add_to_cart");
});

test("complex goals are routed to the LLM planner, not the deterministic fallback", () => {
  const input: GoalInput = {
    goal: "Login to the store, find the Sauce Labs Backpack, check its price. If the price is higher than $25, pause and ask.",
    varianceThresholdPct: 10,
    fallbackPolicy: "default_wholesale",
  };

  const plan = getFallbackPlan(input);

  assert.ok(plan, "expected a fallback plan");
  assert.equal(plan?.needsClarification, true);
  assert.equal(plan?.plan.length, 0);
});
