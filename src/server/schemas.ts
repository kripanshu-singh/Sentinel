/**
 * src/server/schemas.ts
 *
 * Zod schemas for every API boundary in the Sentinel frontend.
 * All types are inferred from schemas — never hand-write duplicate interfaces.
 * These schemas live server-side only; never import them in "use client" modules.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Domain primitives
// ---------------------------------------------------------------------------

export const RunStatusSchema = z.enum([
  "PENDING",
  "PARSED",
  "NAVIGATING",
  "EXTRACTING",
  "CHECKING",
  "HITL_PENDING",
  "RESUME",
  "FORM_FILLING",
  "VALIDATING",
  "RECOVERING",
  "DRAFT_READY",
  "DONE",
  "ABORTED",
  "FAILED",
]);

export const AgentEventTypeSchema = z.enum([
  "NAVIGATE",
  "SEARCH",
  "EXTRACT",
  "CHECK",
  "HITL",
  "FORM_FILL",
  "VALIDATE",
  "RECOVER",
  "DRAFT",
]);

export const AgentEventStatusSchema = z.enum(["success", "error", "pending"]);

// ---------------------------------------------------------------------------
// GoalInput — validated on POST /api/runs
// ---------------------------------------------------------------------------

export const FallbackPolicySchema = z.enum([
  "default_wholesale",
  "best_available",
  "abort",
]);

export const GoalInputSchema = z.object({
  goal: z.string().min(1, "Goal is required").max(2000),
  targetUnitPrice: z.number().positive().optional(),
  varianceThresholdPct: z.number().min(0).max(100).default(10),
  discountCode: z.string().max(64).optional(),
  fallbackPolicy: FallbackPolicySchema.default("default_wholesale"),
});

export type GoalInput = z.infer<typeof GoalInputSchema>;

// ---------------------------------------------------------------------------
// AgentEvent — validated when received from worker over SSE
// ---------------------------------------------------------------------------

export const AgentEventSchema = z.object({
  id: z.string(),
  runId: z.string(),
  type: AgentEventTypeSchema,
  title: z.string(),
  detail: z.string(),
  timestamp: z.string(),
  status: AgentEventStatusSchema.optional(),
  evidence: z.record(z.string(), z.unknown()).optional(),
});

export type AgentEvent = z.infer<typeof AgentEventSchema>;

// ---------------------------------------------------------------------------
// ApprovalResolution — validated on POST /api/runs/[runId]/resolve
// ---------------------------------------------------------------------------

export const ApprovalResolutionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({
    action: z.literal("override"),
    overrideTarget: z.number().positive(),
  }),
  z.object({ action: z.literal("abort") }),
]);

export type ApprovalResolution = z.infer<typeof ApprovalResolutionSchema>;

// ---------------------------------------------------------------------------
// Worker responses — validated before touching downstream code
// ---------------------------------------------------------------------------

export const DiscrepancySchema = z.object({
  kind: z.enum(["price", "discount", "inventory", "margin"]),
  expected: z.union([z.string(), z.number()]),
  actual: z.union([z.string(), z.number()]),
  variancePct: z.number(),
  threshold: z.number(),
  severity: z.enum(["low", "medium", "high"]),
});

export const ApprovalRequestSchema = z.object({
  id: z.string(),
  runId: z.string(),
  title: z.string(),
  detail: z.string(),
  discrepancies: z.array(DiscrepancySchema),
  resolution: ApprovalResolutionSchema.optional(),
});

export const LineItemSchema = z.object({
  sku: z.string(),
  description: z.string(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  lineTotal: z.number().nonnegative(),
  discounts: z.number().nonnegative().default(0),
  status: z.enum(["ok", "flagged", "confirmed"]),
});

export const ChannelSnapshotSchema = z.object({
  channel: z.string(),
  price: z.number().nonnegative(),
  discount: z.number().nonnegative(),
  shipping: z.number().nonnegative(),
  computedMargin: z.number(),
});

export const ReconciliationReportSchema = z.object({
  runId: z.string(),
  generatedAt: z.string(),
  items: z.array(LineItemSchema),
  discrepancies: z.array(DiscrepancySchema),
  channels: z.array(ChannelSnapshotSchema).optional(),
  summary: z.string(),
});

export const RunSummarySchema = z.object({
  runId: z.string(),
  status: RunStatusSchema,
  goal: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  report: ReconciliationReportSchema.optional(),
  currentApprovalRequest: ApprovalRequestSchema.optional(),
});

export const StartRunResponseSchema = z.object({
  runId: z.string().min(1),
});

export const WorkerSuccessResponseSchema = z.object({
  ok: z.literal(true),
});

export type RunSummary = z.infer<typeof RunSummarySchema>;
export type ReconciliationReport = z.infer<typeof ReconciliationReportSchema>;
export type Discrepancy = z.infer<typeof DiscrepancySchema>;
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
