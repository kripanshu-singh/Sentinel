/**
 * worker/src/agent/rule-engine.ts
 *
 * Pure rule evaluation — no LLM, no I/O, no side effects.
 * Takes extracted prices/discounts and business rules; returns Discrepancy[].
 *
 * Rules:
 * 1. Price variance — actual vs target > threshold → HITL
 * 2. Coupon required but not applied → HITL
 * 3. Margin below floor (if margin rule is set) → HITL
 * 4. Inventory below quantity requested → HITL
 */

import type { Discrepancy, GoalInput } from "../types/index.js";

export interface ExtractedProduct {
  sku: string;
  description: string;
  unitPrice: number;
  discountApplied: number; // 0–1 fraction (e.g. 0.2 = 20% off)
  couponApplied: boolean;
  inventoryAvailable: number;
  quantityRequested: number;
}

export interface RuleCheckResult {
  discrepancies: Discrepancy[];
  /** True if any discrepancy exceeds the HITL threshold */
  requiresHITL: boolean;
  /** True if all discrepancies are within auto-approve limits */
  autoContinue: boolean;
}

// Minimum margin floor (hardcoded for MVP; could come from BusinessRule later)
const MARGIN_FLOOR = 0.05; // 5%

/**
 * Evaluate a single product against the user's business rules.
 */
export function checkProduct(
  product: ExtractedProduct,
  rules: GoalInput
): RuleCheckResult {
  const discrepancies: Discrepancy[] = [];

  // ── Rule 1: Price variance ───────────────────────────────────────────────
  if (rules.targetUnitPrice !== undefined) {
    const target = rules.targetUnitPrice;
    const actual = product.unitPrice;
    const variancePct =
      target > 0 ? ((actual - target) / target) * 100 : 0;
    const absPct = Math.abs(variancePct);

    if (absPct > 0.01) {
      // Only flag non-trivial variance
      const severity: Discrepancy["severity"] =
        absPct > rules.varianceThresholdPct * 2
          ? "high"
          : absPct > rules.varianceThresholdPct
          ? "medium"
          : "low";

      discrepancies.push({
        kind: "price",
        expected: target,
        actual,
        variancePct: Math.round(variancePct * 100) / 100,
        threshold: rules.varianceThresholdPct,
        severity,
      });
    }
  }

  // ── Rule 2: Coupon required but not applied ──────────────────────────────
  if (rules.discountCode && !product.couponApplied) {
    discrepancies.push({
      kind: "discount",
      expected: rules.discountCode,
      actual: "not applied",
      variancePct: 100,
      threshold: 0,
      severity: "medium",
    });
  }

  // ── Rule 3: Inventory below quantity ────────────────────────────────────
  if (product.inventoryAvailable < product.quantityRequested) {
    const shortfall = product.quantityRequested - product.inventoryAvailable;
    discrepancies.push({
      kind: "inventory",
      expected: product.quantityRequested,
      actual: product.inventoryAvailable,
      variancePct: Math.round((shortfall / product.quantityRequested) * 100),
      threshold: 0,
      severity: product.inventoryAvailable === 0 ? "high" : "medium",
    });
  }

  // ── Rule 4: Effective margin floor ──────────────────────────────────────
  // Margin = (targetPrice - actualPrice) / targetPrice (rough proxy)
  if (rules.targetUnitPrice !== undefined) {
    const margin =
      (rules.targetUnitPrice - product.unitPrice) / rules.targetUnitPrice;
    if (margin < MARGIN_FLOOR) {
      discrepancies.push({
        kind: "margin",
        expected: `≥${(MARGIN_FLOOR * 100).toFixed(0)}%`,
        actual: `${(margin * 100).toFixed(1)}%`,
        variancePct: Math.round((MARGIN_FLOOR - margin) * 10000) / 100,
        threshold: MARGIN_FLOOR * 100,
        severity: margin < 0 ? "high" : "low",
      });
    }
  }

  // A discrepancy requires HITL if it's medium/high severity
  const requiresHITL = discrepancies.some(
    (d) => d.severity === "medium" || d.severity === "high"
  );

  return {
    discrepancies,
    requiresHITL,
    autoContinue: !requiresHITL,
  };
}

/**
 * Recompute price discrepancy after a human overrides the target price.
 * Returns an updated result with the new target applied.
 */
export function recheck(
  product: ExtractedProduct,
  rules: GoalInput,
  overrideTarget: number
): RuleCheckResult {
  return checkProduct(product, { ...rules, targetUnitPrice: overrideTarget });
}
