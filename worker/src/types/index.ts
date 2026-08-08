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
  | "DRAFT"
  | "STEER";

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

/**
 * A live operator redirect (ADR-012). Sent via POST /runs/:id/steer and drained
 * by the `execute` node at step boundaries. Mirrors src/types/index.ts.
 */
export interface SteerInstruction {
  instruction: string;
}

// ---------------------------------------------------------------------------
// Business rules
// ---------------------------------------------------------------------------

export type FallbackPolicy = "default_wholesale" | "best_available" | "abort";

export interface GoalInput {
  goal: string;
  /** Optional target storefront URL (e.g. https://www.amazon.com). When provided,
   * the agent navigates here instead of requiring the goal to name a URL. */
  storefrontUrl?: string;
  /** Optional login credentials for login-gated storefronts. When absent and a
   * login form is detected, the agent will pause and ask for human input. */
  credentials?: { username: string; password: string };
  targetUnitPrice?: number;
  targetSubtotal?: number;
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

export type ApprovalAction = "approve" | "override" | "abort" | "custom";

export interface ApprovalResolution {
  action: ApprovalAction;
  overrideTarget?: number;
  /** Free-form operator instruction sent with a "custom" resolution. */
  instruction?: string;
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
  url?: string;
}

export interface ChannelSnapshot {
  channel: string;
  price: number;
  discount: number;
  shipping: number;
  computedMargin: number;
}

export interface ComparisonItem {
  name: string;
  price: number;
  rating?: number;
  reviewsCount?: number;
  specs?: Record<string, string>;
  isBestPick?: boolean;
  verdict?: string;
  url?: string;
}

export interface ReconciliationReport {
  runId: string;
  generatedAt: string;
  items: LineItem[];
  discrepancies: Discrepancy[];
  channels?: ChannelSnapshot[];
  comparison?: ComparisonItem[];
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
  | "pause_for_approval"
  | "fill_form"
  | "validate"
  | "draft_report";

export interface StepPlan {
  kind: StepKind;
  description: string;
  params?: Record<string, unknown>;
}
