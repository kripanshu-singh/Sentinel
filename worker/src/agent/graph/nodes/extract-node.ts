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

function targetNameFromPlan(
  plan: StepPlan[],
  stepIndex: number,
  goal: string
): string {
  // Prefer the extract step's explicit target, then the plan's search query
  // (both set by the LLM from the goal), then the user's goal text. Never a
  // hardcoded product name.
  const currentIndex = stepIndex - 1;
  const step = plan[currentIndex];
  
  let lastSearchQuery: string | undefined;
  for (let i = currentIndex; i >= 0; i--) {
    if (plan[i]?.kind === "search") {
      lastSearchQuery = plan[i]?.params?.query as string | undefined;
      break;
    }
  }

  return (
    (step?.params?.targetName as string | undefined) ??
    lastSearchQuery ??
    goal
  );
}

/**
 * Find the quantity the plan asks to add for a given target product. Multi-product
 * goals can request different quantities per item, so the extractor must not
 * assume 1 unit for every product. Falls back to 1 when the plan doesn't say.
 */
function quantityForTarget(plan: StepPlan[], targetName: string): number {
  const normalized = targetName.trim().toLowerCase();
  for (const step of plan) {
    if (step.kind !== "add_to_cart") continue;
    const name =
      (step.params?.targetName as string | undefined) ??
      (step.params?.query as string | undefined);
    if (name && name.trim().toLowerCase() === normalized) {
      const qty = step.params?.quantity;
      if (typeof qty === "number" && Number.isFinite(qty) && qty > 0) {
        return Math.round(qty);
      }
    }
  }
  return 1;
}

export async function extractNode(
  state: SentinelStateValue
): Promise<SentinelStateUpdate> {
  const { runId, input, planResult, stepIndex } = state;

  if (state.status === "FAILED" || state.status === "ABORTED") {
    return { next: "end" };
  }

  const targetName = targetNameFromPlan(planResult?.plan ?? [], stepIndex, input.goal);

  await transition(runId, "EXTRACTING");
  await emitEvent(runId, "EXTRACT", "Extracting product details", `Parsing DOM for "${targetName}"`, "pending");

  const session = await sessionManager.get(runId);
  const html = await session.navigator.getDOMSnapshot();
  const { product, confidence } = await extractProductFromDOM(html, targetName);

  // Carry the exact quantity the plan requested for THIS product so the report's
  // subtotal reflects real quantities, not a blanket "1 unit".
  const qty = quantityForTarget(planResult?.plan ?? [], targetName);
  if (qty > 1) {
    product.quantityRequested = qty;
  }

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
    extractedProducts: [{ product, confidence }],
    status: "EXTRACTING",
    next: "validate",
  };
}
