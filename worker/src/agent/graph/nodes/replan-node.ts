/**
 * worker/src/agent/graph/nodes/replan-node.ts
 *
 * REPLAN node — Phase C. Reached from `validate` (extraction failure) or
 * `execute` (step error) when the triggering node still has retry budget.
 *
 * Feeds the structured `ReplanEntry[]` history + per-node retry counts to the
 * planner so the LLM can pick a different strategy, replaces the plan, and
 * routes back to `execute` (which replays from step 0). An empty revised plan
 * or an exhausted budget is terminal → FAILED.
 */

import { planGoal } from "../../planner.js";
import { emitEvent, transition } from "../emit.js";
import { failRun } from "../retry.js";
import type { SentinelStateUpdate, SentinelStateValue } from "../state.js";

export async function replanNode(
  state: SentinelStateValue
): Promise<SentinelStateUpdate> {
  const { runId, input, replanContext, nodeRetries } = state;

  if (state.status === "FAILED" || state.status === "ABORTED") {
    return { next: "end" };
  }

  await transition(runId, "RECOVERING");
  await emitEvent(
    runId,
    "NAVIGATE",
    "Replanning…",
    `Adapting strategy after ${replanContext.length} failed attempt(s).`,
    "pending"
  );

  const humanInstruction = replanContext.find(
    (e) => e.reason === "human_instruction"
  )?.detail;

  // A human instruction is the operator directing the run; fed to the planner as
  // the primary revised requirement. Failure context is the same structured list
  // otherwise (Phase C).
  const contextText = humanInstruction
    ? `The human operator gave this instruction — treat it as the highest-priority requirement for the revised plan: ${humanInstruction}`
    : replanContext
        .map((e) => `- node=${e.node}, reason=${e.reason}, retry=${e.retry}: ${e.detail}`)
        .join("\n");

  let planResult;
  try {
    // When a human already gave an instruction at the approval gate, don't
    // re-inject a pause_for_approval step into the revised plan — they've
    // already engaged, and re-pausing would block them again.
    planResult = await planGoal(input, contextText, {
      skipApprovalInjection: Boolean(humanInstruction),
    });
  } catch (error: unknown) {
    return failRun(
      runId,
      "DRAFT",
      "Replan failed",
      error instanceof Error ? error.message : "Replanning crashed"
    );
  }

  await emitEvent(
    runId,
    "NAVIGATE",
    "Plan revised",
    `Revised into ${planResult.plan.length} steps (node retries: ${JSON.stringify(nodeRetries)})`,
    "success"
  );

  if (planResult.plan.length === 0) {
    return failRun(
      runId,
      "DRAFT",
      "Replan produced no plan",
      "No actionable steps after replanning. Please refine the goal."
    );
  }

  // Replay from the top of the revised plan. Re-running already-succeeded
  // steps is idempotent by design (principle 6).
  return {
    planResult,
    stepIndex: 0,
    status: "RECOVERING",
    next: "execute",
  };
}
