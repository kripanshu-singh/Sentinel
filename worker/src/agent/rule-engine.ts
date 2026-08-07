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
      // Only flag non-trivial variance. Any price ABOVE the target pauses for
      // human approval (hard cap), regardless of how far over — that is what
      // "if the price is higher than $25, pause" means. Prices below target
      // auto-approve unless the variance is extreme.
      const severity: Discrepancy["severity"] =
        actual > target
          ? absPct > rules.varianceThresholdPct * 2
            ? "high"
            : "medium"
          : absPct > rules.varianceThresholdPct * 2
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

export interface SubtotalItem {
  lineTotal: number;
}

/**
 * Evaluate the COMBINED cart subtotal against the business rules (multi-product).
 * Any variance above the auto-approve threshold → HITL. This is the aggregate
 * gate for goals like "combined subtotal must not exceed $50".
 */
export function checkSubtotal(
  items: SubtotalItem[],
  rules: GoalInput
): RuleCheckResult {
  const discrepancies: Discrepancy[] = [];
  const actualSubtotal = items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  const target = rules.targetSubtotal;

  if (target !== undefined && actualSubtotal > target) {
    const variancePct = target > 0 ? ((actualSubtotal - target) / target) * 100 : 0;
    const absPct = Math.abs(variancePct);

    // A combined-subtotal gate is a CEILING ("must not exceed $50"): going over
    // always pauses (medium/high by how far over), going under never does.
    const severity: Discrepancy["severity"] =
      absPct > rules.varianceThresholdPct * 2 ? "high" : "medium";

    discrepancies.push({
      kind: "price",
      expected: target,
      actual: Math.round(actualSubtotal * 100) / 100,
      variancePct: Math.round(variancePct * 100) / 100,
      threshold: rules.varianceThresholdPct,
      severity,
    });
  }

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
 * Recompute the combined subtotal discrepancy after a human overrides the
 * subtotal target (usually because they accept the higher total).
 */
export function recheckSubtotal(
  items: SubtotalItem[],
  rules: GoalInput,
  overrideTarget: number
): RuleCheckResult {
  return checkSubtotal(items, { ...rules, targetSubtotal: overrideTarget });
}
