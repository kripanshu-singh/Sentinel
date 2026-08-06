export type RunStatus =
  | "PENDING"
  | "RUNNING"
  | "PAUSED_HITL"
  | "DONE"
  | "ABORTED";

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
}

export interface Discrepancy {
  field: string;
  expected: string | number;
  actual: string | number;
  variancePct: number;
  thresholdPct: number;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  title: string;
  discrepancy: Discrepancy;
  timestamp: string;
}

export interface GoalInput {
  goal: string;
  targetUnitPrice?: number;
  varianceThresholdPct: number;
  discountCode?: string;
  fallbackPolicy: "default_wholesale" | "best_available" | "abort";
}

export interface ReconciliationLineItem {
  sku: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  status: "ok" | "flagged" | "confirmed";
}

export interface ChannelSnapshot {
  channel: string;
  price: number;
  discount: number;
  shipping: number;
  margin: number;
  variancePct: number;
  aboveThreshold: boolean;
}

export interface ReconciliationReport {
  runId: string;
  outcome: "DONE" | "ABORTED";
  generatedAt: string;
  summary: string;
  lineItems: ReconciliationLineItem[];
  channelSnapshots?: ChannelSnapshot[];
}
