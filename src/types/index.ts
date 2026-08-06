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

export interface GoalInput {
  goal: string;
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
