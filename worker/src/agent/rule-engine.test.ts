import test from "node:test";
import assert from "node:assert/strict";
import { checkSubtotal, recheckSubtotal } from "./rule-engine.js";

function baseRules() {
  return {
    goal: "test",
    varianceThresholdPct: 10,
    fallbackPolicy: "default_wholesale" as const,
  };
}

test("checkSubtotal passes when combined subtotal is under target", () => {
  const result = checkSubtotal(
    [{ lineTotal: 49.99 }, { lineTotal: 9.99 }],
    { ...baseRules(), targetSubtotal: 100 },
  );
  assert.equal(result.discrepancies.length, 0);
  assert.equal(result.requiresHITL, false);
  assert.equal(result.autoContinue, true);
});

test("checkSubtotal pauses (HITL) when combined subtotal exceeds target", () => {
  const result = checkSubtotal(
    [{ lineTotal: 49.99 }, { lineTotal: 9.99 }],
    { ...baseRules(), targetSubtotal: 50 },
  );
  assert.equal(result.discrepancies.length, 1);
  assert.equal(result.discrepancies[0].kind, "price");
  assert.equal(result.discrepancies[0].expected, 50);
  // 59.98 vs 50 → +19.96%
  assert.ok(Math.abs(result.discrepancies[0].variancePct - 19.96) < 0.01);
  assert.equal(result.requiresHITL, true);
});

test("checkSubtotal aggregates ALL line items (multi-product never drops)", () => {
  const result = checkSubtotal(
    [{ lineTotal: 49.99 }, { lineTotal: 9.99 }, { lineTotal: 4.5 }],
    { ...baseRules(), targetSubtotal: 60 },
  );
  assert.equal(result.discrepancies[0].actual, 64.48);
});

test("recheckSubtotal recomputes against an overridden target", () => {
  const items = [{ lineTotal: 49.99 }, { lineTotal: 9.99 }];
  const before = checkSubtotal(items, { ...baseRules(), targetSubtotal: 50 });
  assert.equal(before.requiresHITL, true);

  const after = recheckSubtotal(items, baseRules(), 100);
  assert.equal(after.requiresHITL, false);
  assert.equal(after.discrepancies.length, 0);
});
