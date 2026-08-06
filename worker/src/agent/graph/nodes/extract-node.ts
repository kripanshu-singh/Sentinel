/**
 * worker/src/agent/graph/nodes/extract-node.ts
 *
 * EXTRACT node — DOM snapshot → { product, confidence }.
 * Runs only when the execute machine reaches an `extract_product` checkpoint.
 */

import { extractProductFromDOM } from "../../extractor.js";
import { sessionManager } from "../../session/session-manager.js";
import { emitEvent, transition } from "../emit.js";
import type { StepPlan } from "../../../types/index.js";
import type { SentinelStateUpdate, SentinelStateValue } from "../state.js";

function targetNameFromPlan(plan: StepPlan[], stepIndex: number): string {
  const step = plan[stepIndex - 1];
  return (step?.params?.targetName as string | undefined) ?? "Milk";
}

export async function extractNode(
  state: SentinelStateValue
): Promise<SentinelStateUpdate> {
  const { runId, planResult, stepIndex } = state;

  if (state.status === "FAILED" || state.status === "ABORTED") {
    return { next: "validate" };
  }

  const targetName = targetNameFromPlan(planResult?.plan ?? [], stepIndex);

  await transition(runId, "EXTRACTING");
  await emitEvent(runId, "EXTRACT", "Extracting product details", `Parsing DOM for "${targetName}"`, "pending");

  const session = await sessionManager.get(runId);
  const html = await session.navigator.getDOMSnapshot();
  const { product, confidence } = await extractProductFromDOM(html, targetName);

  await emitEvent(
    runId,
    "EXTRACT",
    "Product details extracted",
    `Found SKU: ${product.sku} - Price: $${product.unitPrice}`,
    "success",
    { product, confidence }
  );

  return {
    currentProduct: { product, confidence },
    status: "EXTRACTING",
    next: "validate",
  };
}
