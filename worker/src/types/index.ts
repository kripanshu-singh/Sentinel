/**
 * worker/src/types/index.ts
 *
 * Shared domain types — mirrors src/types/index.ts in the Next.js frontend.
 * These are the wire contract between the frontend and the worker.
 * Never diverge these two files without updating both sides.
 */

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

export type RunStatus =
  | "PENDING"
  | "PARSED"
  | "NAVIGATING"
  | "EXTRACTING"
  | "CHECKING"
  | "HITL_PENDING"
  | "RESUME"
  | "FORM_FILLING"
  | "VALIDATING"
  | "RECOVERING"
  | "DRAFT_READY"
  | "DONE"
  | "ABORTED"
  | "FAILED";

export type AgentEventType =
  | "NAVIGATE"
  | "SEARCH"
  | "EXTRACT"
  | "CHECK"
  | "HITL"
  | "FORM_FILL"
  | "VALIDATE"
  | "RECOVER"
  | "DRAFT";

export type AgentEventStatus = "success" | "error" | "pending";

export interface AgentEvent {
  id: string;
  runId: string;
  type: AgentEventType;
  title: string;
  detail: string;
  timestamp: string;
  status?: AgentEventStatus;
  evidence?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Business rules
// ---------------------------------------------------------------------------

export type FallbackPolicy = "default_wholesale" | "best_available" | "abort";

export interface GoalInput {
  goal: string;
  targetUnitPrice?: number;
  varianceThresholdPct: number;
  discountCode?: string;
  fallbackPolicy: FallbackPolicy;
}

// ---------------------------------------------------------------------------
// Discrepancies + HITL
// ---------------------------------------------------------------------------

export interface Discrepancy {
  kind: "price" | "discount" | "inventory" | "margin";
  expected: string | number;
  actual: string | number;
  variancePct: number;
  threshold: number;
  severity: "low" | "medium" | "high";
}

export type ApprovalAction = "approve" | "override" | "abort";

export interface ApprovalResolution {
  action: ApprovalAction;
  overrideTarget?: number;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  title: string;
  detail: string;
  discrepancies: Discrepancy[];
  resolution?: ApprovalResolution;
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export interface LineItem {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  discounts: number;
  status: "ok" | "flagged" | "confirmed";
}

export interface ChannelSnapshot {
  channel: string;
  price: number;
  discount: number;
  shipping: number;
  computedMargin: number;
}

export interface ReconciliationReport {
  runId: string;
  generatedAt: string;
  items: LineItem[];
  discrepancies: Discrepancy[];
  channels?: ChannelSnapshot[];
  summary: string;
}

// ---------------------------------------------------------------------------
// Run summary (returned by GET /runs/:id)
// ---------------------------------------------------------------------------

export interface RunSummary {
  runId: string;
  status: RunStatus;
  goal: string;
  createdAt: string;
  updatedAt: string;
  report?: ReconciliationReport;
  currentApprovalRequest?: ApprovalRequest;
}

// ---------------------------------------------------------------------------
// Step plan — internal to the worker, not on the wire contract
// ---------------------------------------------------------------------------

export type StepKind =
  | "navigate"
  | "search"
  | "extract_product"
  | "check_price"
  | "add_to_cart"
  | "apply_coupon"
  | "fill_form"
  | "validate"
  | "draft_report";

export interface StepPlan {
  kind: StepKind;
  description: string;
  params?: Record<string, unknown>;
}
