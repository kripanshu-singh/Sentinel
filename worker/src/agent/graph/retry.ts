/**
 * worker/src/agent/graph/retry.ts
 *
 * Phase C — bounded replan helpers shared by the nodes that can trigger a
 * replan (extract failure via `validate`, step errors via `execute`).
 *
 * Retries are tracked PER NODE (`nodeRetries[node]`), not a single global
 * counter, so one node's failures can't starve another's budget.
 */

import { emitEvent, transition } from "./emit.js";
import type { AgentEventType } from "../../types/index.js";
import type { SentinelStateUpdate, SentinelStateValue } from "./state.js";

/** Default replan cap per node (plan doc §10). */
export const MAX_RETRIES_PER_NODE = 2;

/**
 * Build the state update that hands off to the REPLAN node for a given node:
 * increments that node's retry count and appends a structured ReplanEntry.
 */
export function retryUpdate(
  state: SentinelStateValue,
  node: string,
  reason: string,
  detail: string
): SentinelStateUpdate {
  const retries = state.nodeRetries[node] ?? 0;
  const retry = retries + 1;
  return {
    next: "replan",
    status: "RECOVERING",
    nodeRetries: { [node]: retry },
    replanContext: [
      {
        node,
        reason,
        retry,
        detail,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Terminal failure: mark the run FAILED (DB + Redis), emit the error event,
 * and return the state update that routes the graph to END.
 */
export async function failRun(
  runId: string,
  type: AgentEventType,
  title: string,
  detail: string
): Promise<SentinelStateUpdate> {
  await transition(runId, "FAILED");
  await emitEvent(runId, type, title, detail, "error");
  return { status: "FAILED", next: "end" };
}
