/**
 * worker/src/agent/graph/nodes/plan-node.ts
 *
 * PLAN node — goal → PlanResult. Sets up the run record and routes to execute,
 * or marks FAILED (terminal) when the goal is too vague to act on.
 */

import { planGoal } from "../../planner.js";
import { emitEvent, transition } from "../emit.js";
import type { SentinelStateUpdate, SentinelStateValue } from "../state.js";

export async function planNode(
  state: SentinelStateValue
): Promise<SentinelStateUpdate> {
  const { runId, input } = state;

  await transition(runId, "PARSED");
  await emitEvent(
    runId,
    "NAVIGATE",
    "Goal parsed",
    "Decomposing task into actionable step plan",
    "success"
  );

  const planResult = await planGoal(input);
  await emitEvent(
    runId,
    "NAVIGATE",
    "Plan generated",
    `Decomposed into ${planResult.plan.length} steps`,
    "success",
    { plan: planResult.plan }
  );

  if (planResult.plan.length === 0 || planResult.needsClarification) {
    await emitEvent(
      runId,
      "NAVIGATE",
      "Goal too vague",
      "Could not decompose the goal into actionable steps. Please specify the product, quantity, and any other relevant details (e.g. vendor, delivery window).",
      "error"
    );
    await transition(runId, "FAILED");
    return { planResult, status: "FAILED", next: "end" };
  }

  return { planResult, status: "PARSED", stepIndex: 0, next: "execute" };
}
