/**
 * worker/src/agent/graph/graph.ts
 *
 * Sentinel agent graph (LangGraph.js StateGraph).
 *
 * Phase A+B+C: deterministic main line `plan → execute ⇄ extract ⇄ validate
 * [→ hitl | → replan] → report`. Conditional edges are deterministic step
 * routing (a state channel `next`, set in code — never by an LLM), the HITL
 * gate (`validate → hitl` when a discrepancy needs a human), and the replan
 * loop (`validate/execute → replan` on failed extraction or a thrown step
 * error, bounded per-node by `nodeRetries`).
 *
 * The `execute` node is a one-step-at-a-time machine: it processes a single plan
 * step per invocation and routes via `next` to keep processing (self-loop),
 * hand off extraction/validation, pause at the HITL gate, replan on step
 * errors, or finish at the report node.
 */

import { END, START, StateGraph } from "@langchain/langgraph";
import { SentinelState, type SentinelStateValue } from "./state.js";
import { planNode } from "./nodes/plan-node.js";
import { executeNode } from "./nodes/execute-node.js";
import { extractNode } from "./nodes/extract-node.js";
import { validateNode } from "./nodes/validate-node.js";
import { hitlNode } from "./nodes/hitl-node.js";
import { replanNode } from "./nodes/replan-node.js";
import { reportNode } from "./nodes/report-node.js";
import { emitEvent, transition } from "./emit.js";
import { sessionManager } from "../session/session-manager.js";
import type { GoalInput } from "../../types/index.js";

const RECURSION_LIMIT = 200;

type MachineNode = "execute" | "extract" | "validate" | "replan" | "report_node";
const MACHINE_NODES: MachineNode[] = ["execute", "extract", "validate", "replan", "report_node"];

export function buildSentinelGraph() {
  return new StateGraph(SentinelState)
    .addNode("plan", planNode)
    .addNode("execute", executeNode)
    .addNode("extract", extractNode)
    .addNode("validate", validateNode)
    .addNode("hitl", hitlNode)
    .addNode("replan", replanNode)
    .addNode("report_node", reportNode)
    .addEdge(START, "plan")
    .addConditionalEdges(
      "plan",
      (s: SentinelStateValue) => (s.next === "end" ? END : "execute"),
      ["execute", END]
    )
    .addConditionalEdges(
      "execute",
      (s: SentinelStateValue) => {
        if (s.next === "end") return END;
        return (MACHINE_NODES as readonly string[]).includes(s.next)
          ? (s.next as MachineNode)
          : "execute";
      },
      [...MACHINE_NODES, END]
    )
    .addEdge("extract", "validate")
    .addConditionalEdges(
      "validate",
      (s: SentinelStateValue) => {
        if (s.next === "end") return END;
        if (s.next === "hitl" || s.next === "replan" || s.next === "execute") {
          return s.next;
        }
        return "execute";
      },
      ["execute", "hitl", "replan", END]
    )
    .addConditionalEdges(
      "hitl",
      (s: SentinelStateValue) => (s.next === "end" ? END : "execute"),
      ["execute", END]
    )
    .addConditionalEdges(
      "replan",
      (s: SentinelStateValue) => (s.next === "end" ? END : "execute"),
      ["execute", END]
    )
    .addEdge("report_node", END)
    .compile();
}

/**
 * Run a full agent run inside the graph. The BullMQ job handler calls this.
 * Any unhandled error marks the run FAILED (terminal) with an error event; the
 * browser session is always released in `finally`.
 */
export async function runGraph(runId: string, input: GoalInput): Promise<void> {
  const graph = buildSentinelGraph();
  try {
    await graph.invoke({ runId, input }, { recursionLimit: RECURSION_LIMIT });
  } catch (error: unknown) {
    console.error(`[graph:${runId}] Run crashed:`, error);
    await transition(runId, "FAILED");
    await emitEvent(
      runId,
      "DRAFT",
      "Fatal error",
      error instanceof Error ? error.message : "Orchestration pipeline failure",
      "error"
    );
  } finally {
    await sessionManager.close(runId);
  }
}
