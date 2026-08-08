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

export interface AgentEvent {
  id: string;
  runId: string;
  type: AgentEventType;
  title: string;
  detail: string;
  timestamp: string;
  status?: "success" | "error" | "pending";
  /** Worker-attached structured payload: screenshots, URLs, products, discrepancies. */
  evidence?: Record<string, unknown>;
}

/** A live operator redirect, pushed via POST /api/runs/[runId]/steer (ADR-012). */
export interface SteerInstruction {
  instruction: string;
}

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
  fallbackPolicy: "default_wholesale" | "best_available" | "abort";
}

export interface Discrepancy {
  kind: "price" | "discount" | "inventory" | "margin";
  expected: string | number;
  actual: string | number;
  variancePct: number;
  threshold: number;
  severity: "low" | "medium" | "high";
}

export interface ApprovalResolution {
  action: "approve" | "override" | "abort" | "custom";
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

export interface RunSummary {
  runId: string;
  status: RunStatus;
  goal: string;
  createdAt: string;
  updatedAt: string;
  report?: ReconciliationReport;
  currentApprovalRequest?: ApprovalRequest;
}
