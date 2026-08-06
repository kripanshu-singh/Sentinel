import { log } from "../../lib/logger.js";
import type { SentinelStateUpdate, SentinelStateValue } from "./state.js";

export type GraphNode = (state: SentinelStateValue) => Promise<SentinelStateUpdate>;

/**
 * Compact summary of the state a node receives — i.e. what the previous node
 * handed over (run context, current step, product, discrepancies, routing).
 */
function summarizeState(state: SentinelStateValue): Record<string, unknown> {
  const step = state.planResult?.plan[state.stepIndex];
  return {
    runId: state.runId,
    status: state.status,
    step: step ? `${state.stepIndex}:${step.kind}` : state.stepIndex,
    nodeRetries: state.nodeRetries,
    pendingHITL: state.pendingHITL,
    resolution: state.resolution?.action,
    product: state.currentProduct
      ? {
          sku: state.currentProduct.product.sku,
          unitPrice: state.currentProduct.product.unitPrice,
          confidence: state.currentProduct.confidence,
        }
      : null,
    discrepancies: state.discrepancies.length,
    replans: state.replanContext.length,
    lastAction: state.lastAction,
    next: state.next,
  };
}

/** Compact summary of the update a node returns — i.e. what it sends onward. */
function summarizeUpdate(update: SentinelStateUpdate): Record<string, unknown> {
  const summary: Record<string, unknown> = {};

  if (update.status !== undefined) summary.status = update.status;
  if (update.stepIndex !== undefined) summary.stepIndex = update.stepIndex;
  if (update.nodeRetries !== undefined) summary.nodeRetries = update.nodeRetries;
  if (update.pendingHITL !== undefined) summary.pendingHITL = update.pendingHITL;
  if (update.resolution != null) summary.resolution = update.resolution;
  if (update.lastAction !== undefined) summary.lastAction = update.lastAction;
  if (update.currentURL !== undefined) summary.currentURL = update.currentURL;

  if (update.currentProduct != null) {
    summary.product = {
      sku: update.currentProduct.product.sku,
      unitPrice: update.currentProduct.product.unitPrice,
      confidence: update.currentProduct.confidence,
    };
  }
  if (Array.isArray(update.discrepancies)) {
    summary.discrepancies = update.discrepancies.length;
  }
  if (update.planResult != null) {
    summary.plan = update.planResult.plan.map((p) => `${p.kind}:${p.description}`);
    summary.estimatedSteps = update.planResult.estimatedSteps;
  }
  if (update.report != null) {
    summary.report = {
      items: update.report.items.length,
      discrepancies: update.report.discrepancies.length,
      channels: update.report.channels?.length ?? 0,
      summary: update.report.summary,
    };
  }

  return summary;
}

export function loggedNode(name: string, node: GraphNode): GraphNode {
  return async (state: SentinelStateValue) => {
    log("graph", `>> ${name}`, summarizeState(state));
    const update = await node(state);
    log("graph", `<< ${name} → ${update.next ?? "?"}`, summarizeUpdate(update));
    return update;
  };
}
