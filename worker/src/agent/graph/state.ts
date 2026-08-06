/**
 * worker/src/agent/graph/state.ts
 *
 * LangGraph state schema for the Sentinel agent run.
 *
 * The shared AgentState object is how the specialist nodes "talk to each other":
 * `execute` writes transparency + session fields, `extract` writes the product +
 * confidence, `validate` writes discrepancies, `report` reads everything to build
 * the final artifact. Browser objects never live here — only a `sessionId`.
 */

import { Annotation } from "@langchain/langgraph";
import type {
  AgentEvent,
  ApprovalResolution,
  Discrepancy,
  GoalInput,
  ReconciliationReport,
  RunStatus,
  StepPlan,
} from "../../types/index.js";
import type { ExtractedProduct } from "../rule-engine.js";

// ---------------------------------------------------------------------------
// Planning output
// ---------------------------------------------------------------------------

export interface PlanResult {
  /** Normalized restatement of the goal. */
  goal: string;
  plan: StepPlan[];
  needsClarification: boolean;
  risk: "low" | "medium" | "high";
  confidence: number; // 0..1
  estimatedSteps: number;
}

// ---------------------------------------------------------------------------
// Replanning context (structured, not free text)
// ---------------------------------------------------------------------------

export interface ReplanEntry {
  node: string; // e.g. "extract"
  reason: string; // e.g. "missing_price" | "low_confidence" | "step_error"
  retry: number; // current retry count for that node
  detail: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Extraction output
// ---------------------------------------------------------------------------

export interface ProductExtraction {
  product: ExtractedProduct;
  confidence: number; // 0..1
}

// ---------------------------------------------------------------------------
// Reducers
// ---------------------------------------------------------------------------

function appendList<T>(left: T[], right: T[]): T[] {
  return [...(left ?? []), ...(right ?? [])];
}

function mergeRecord(
  left: Record<string, number>,
  right: Record<string, number>
): Record<string, number> {
  return { ...(left ?? {}), ...(right ?? {}) };
}

/** Last-value-wins channel that is defined (not empty) from the start. */
function lastValueWithDefault<T>(defaultValue: T) {
  return {
    reducer: (_left: T, right: T) => right,
    default: () => defaultValue,
  };
}

// ---------------------------------------------------------------------------
// State schema
// ---------------------------------------------------------------------------

export const SentinelState = Annotation.Root({
  // run context (set once at invoke)
  runId: Annotation<string>(),
  input: Annotation<GoalInput>(),
  status: Annotation<RunStatus>(),

  // session — never browser objects; only a key into SessionManager
  sessionId: Annotation<string | null>(),

  // planning
  planResult: Annotation<PlanResult | null>(),
  stepIndex: Annotation<number>(lastValueWithDefault(0)),
  nodeRetries: Annotation<Record<string, number>>({
    reducer: mergeRecord,
    default: () => ({}),
  }),

  // transparency (UI)
  currentScreenshot: Annotation<string | null>(),
  currentURL: Annotation<string | null>(),
  lastAction: Annotation<string | null>(),

  // extraction / validation
  currentProduct: Annotation<ProductExtraction | null>(),
  extractedProducts: Annotation<ProductExtraction[]>({
    reducer: appendList,
    default: () => [],
  }),
  discrepancies: Annotation<Discrepancy[]>(lastValueWithDefault<Discrepancy[]>([])),
  pendingHITL: Annotation<boolean>(lastValueWithDefault(false)),
  requiresApproval: Annotation<boolean>(lastValueWithDefault(false)),
  resolution: Annotation<ApprovalResolution | null>(),
  approvalHandled: Annotation<boolean>(lastValueWithDefault(false)),

  // output
  report: Annotation<ReconciliationReport | null>(),

  // history
  events: Annotation<AgentEvent[]>({ reducer: appendList, default: () => [] }),
  replanContext: Annotation<ReplanEntry[]>({
    reducer: appendList,
    default: () => [],
  }),

  // internal routing (deterministic code edges only — see graph.ts)
  next: Annotation<string>(lastValueWithDefault("execute")),
});

export type SentinelStateValue = typeof SentinelState.State;
export type SentinelStateUpdate = typeof SentinelState.Update;
export type SentinelStateNode = typeof SentinelState.Node;
