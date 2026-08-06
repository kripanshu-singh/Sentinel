/**
 * worker/src/agent/graph/nodes/validate-node.ts
 *
 * VALIDATE node — runs business rules + completeness checks on the extracted
 * product. Routes by outcome (all in code):
 *
 *   - low confidence / incomplete / missing extraction → REPLAN while the
 *     `extract` node has retry budget, else FAILED (Phase C).
 *   - discrepancy above auto-approve threshold → HITL node (Phase B).
 *   - otherwise → back to EXECUTE.
 *
 * Final-invoice sanity mode (§6 of the migration plan) is deferred: the
 * report node already gates the invoice before commit.
 */

import { checkProduct } from "../../rule-engine.js";
import { emitEvent, transition } from "../emit.js";
import { failRun, MAX_RETRIES_PER_NODE, retryUpdate } from "../retry.js";
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
    return replanOrFail(state, "no_product", "No product extraction available at this checkpoint.");
  }

  const { product, confidence } = currentProduct;
  const result = checkProduct(product, input);
  const incomplete =
    !product.sku || typeof product.unitPrice !== "number" || confidence < MIN_CONFIDENCE;

  if (incomplete) {
    return replanOrFail(
      state,
      "incomplete_extraction",
      `Confidence ${confidence.toFixed(2)}; sku="${product.sku}" unitPrice=${product.unitPrice}`
    );
  }

  if (result.requiresHITL) {
    const lastResolution = state.resolution;
    const shouldProceedAfterResolution =
      state.approvalHandled ||
      lastResolution?.action === "approve" ||
      (lastResolution?.action === "override" && lastResolution.overrideTarget != null);

    if (shouldProceedAfterResolution) {
      await emitEvent(
        runId,
        "CHECK",
        "Human approval accepted",
        "Continuing past the approved discrepancy.",
        "success",
        { resolution: lastResolution?.action ?? "approve" }
      );
      return {
        discrepancies: result.discrepancies,
        pendingHITL: false,
        status: "CHECKING",
        next: "execute",
        approvalHandled: false,
      };
    }

    // Route to the HITL node (Phase B): it registers the approval request, blocks
    // for the operator's decision, and resumes/aborts.
    return {
      discrepancies: result.discrepancies,
      pendingHITL: true,
      status: "CHECKING",
      next: "hitl",
    };
  }

  await emitEvent(
    runId,
    "CHECK",
    "Business rules check passed",
    "All pricing and coupons within acceptable ranges.",
    "success"
  );

  return {
    discrepancies: result.discrepancies,
    pendingHITL: false,
    status: "CHECKING",
    next: "execute",
  };
}

/**
 * Phase C — low confidence / incomplete / missing extraction routes to REPLAN
 * while the `extract` node has retry budget; otherwise the run FAILS.
 */
async function replanOrFail(
  state: SentinelStateValue,
  reason: string,
  detail: string
): Promise<SentinelStateUpdate> {
  const { runId } = state;
  const retries = state.nodeRetries["extract"] ?? 0;

  if (retries >= MAX_RETRIES_PER_NODE) {
    await emitEvent(
      runId,
      "EXTRACT",
      "Extraction failed",
      `Could not recover after ${MAX_RETRIES_PER_NODE} replans (${reason}).`,
      "error",
      { reason, nodeRetries: state.nodeRetries }
    );
    return failRun(runId, "EXTRACT", "Extraction failed", `Could not recover after ${MAX_RETRIES_PER_NODE} replans.`);
  }

  await emitEvent(
    runId,
    "CHECK",
    "Extraction incomplete — replanning",
    `${detail} (attempt ${retries + 1}/${MAX_RETRIES_PER_NODE}).`,
    "error",
    { reason, retry: retries + 1 }
  );
  return { ...retryUpdate(state, "extract", reason, detail), pendingHITL: false };
}
