import test from "node:test";
import assert from "node:assert/strict";
import { getFallbackPlan, injectApprovalStep } from "./planner.js";
import type { GoalInput, StepPlan } from "../types/index.js";

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

test("injects a pause_for_approval step before checkout when the goal asks for confirmation", () => {
  const plan: StepPlan[] = [
    { kind: "add_to_cart", description: "Add to cart", params: {} },
    { kind: "fill_form", description: "Checkout", params: {} },
  ];

  const result = injectApprovalStep(plan, "add to cart, then pause and ask me to confirm before checkout");

  assert.equal(result.length, 3);
  const pauseIndex = result.findIndex((s) => s.kind === "pause_for_approval");
  assert.notEqual(pauseIndex, -1);
  assert.equal(result[pauseIndex + 1]?.kind, "fill_form");
});

test("injectApprovalStep leaves conditional variance gates to the rule engine", () => {
  const plan: StepPlan[] = [
    { kind: "add_to_cart", description: "Add to cart", params: {} },
    { kind: "fill_form", description: "Checkout", params: {} },
  ];

  const result = injectApprovalStep(
    plan,
    "Verify that the combined item subtotal does not exceed $50.00. If the subtotal variance exceeds 10%, pause execution and request human authorization before proceeding to checkout."
  );

  assert.deepEqual(result, plan);
});

test("conditional approval goals do not keep a redundant pause step", () => {
  const plan: StepPlan[] = [
    { kind: "search", description: "Search", params: {} },
    { kind: "pause_for_approval", description: "Pause", params: {} },
    { kind: "add_to_cart", description: "Add", params: {} },
    { kind: "fill_form", description: "Checkout", params: {} },
  ];

  const result = injectApprovalStep(
    plan,
    "Login to the store, find the Sauce Labs Backpack, check its price. If the price is higher than $25, pause and ask for approval before adding it to the cart. Then proceed to checkout."
  );

  assert.equal(result.filter((step) => step.kind === "pause_for_approval").length, 0);
});

test("injectApprovalStep appends the pause step when there is no checkout step", () => {
  const plan: StepPlan[] = [{ kind: "add_to_cart", description: "Add", params: {} }];
  const result = injectApprovalStep(plan, "pause so I can confirm first");
  assert.equal(result[result.length - 1]?.kind, "pause_for_approval");
});

test("injectApprovalStep does not alter goals without a confirmation request", () => {
  const plan: StepPlan[] = [{ kind: "fill_form", description: "Checkout", params: {} }];
  const result = injectApprovalStep(plan, "add the backpack to the cart");
  assert.deepEqual(result, plan);
});
