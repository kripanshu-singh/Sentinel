/**
 * worker/src/agent/graph/nodes/validate-node.ts
 *
 * VALIDATE node — runs business rules + completeness checks on the extracted
 * product. Records discrepancies and whether HITL is required.
 *
 * Phase A (this migration step): discrepancies are recorded but the run does NOT
 * pause — the `validate → HITL` conditional edge lands in Phase B. Phase C adds
 * the replan loop for low-confidence / incomplete extractions.
 */

import { checkProduct } from "../../rule-engine.js";
import { emitEvent, transition } from "../emit.js";
import type { SentinelStateUpdate, SentinelStateValue } from "../state.js";

const MIN_CONFIDENCE = 0.75;

export async function validateNode(
  state: SentinelStateValue
): Promise<SentinelStateUpdate> {
  const { runId, input, currentProduct } = state;

  if (state.status === "FAILED" || state.status === "ABORTED") {
    return { next: "execute" };
  }

  await transition(runId, "CHECKING");
  await emitEvent(runId, "CHECK", "Checking business rules", "Evaluating unit price and inventory thresholds", "pending");

  if (!currentProduct) {
    // Phase C replaces this with the replan loop.
    await emitEvent(
      runId,
      "CHECK",
      "Nothing to validate",
      "No product extraction available at this checkpoint.",
      "error"
    );
    return { status: "CHECKING", next: "execute" };
  }

  const { product, confidence } = currentProduct;
  const result = checkProduct(product, input);
  const incomplete =
    !product.sku || typeof product.unitPrice !== "number" || confidence < MIN_CONFIDENCE;

  if (incomplete) {
    // Phase C replaces this with the replan loop.
    await emitEvent(
      runId,
      "CHECK",
      "Extraction incomplete",
      `Confidence ${confidence.toFixed(2)} or missing fields — replan loop lands in Phase C.`,
      "error",
      { confidence, product }
    );
    return { status: "CHECKING", next: "execute" };
  }

  if (result.requiresHITL) {
    // Phase B adds the actual pause + HITL node. For now, record and continue.
    await emitEvent(
      runId,
      "CHECK",
      "Variance above threshold",
      `Found $${product.unitPrice} - target $${input.targetUnitPrice ?? 0}. Human approval gate lands in Phase B.`,
      "success",
      { discrepancies: result.discrepancies, requiresHITL: true }
    );
  } else {
    await emitEvent(
      runId,
      "CHECK",
      "Business rules check passed",
      "All pricing and coupons within acceptable ranges.",
      "success"
    );
  }

  return {
    discrepancies: result.discrepancies,
    pendingHITL: result.requiresHITL,
    status: "CHECKING",
    next: "execute",
  };
}
