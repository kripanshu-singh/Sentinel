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
  "STEER",
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
  /** Optional target storefront URL (e.g. https://www.amazon.com) */
  storefrontUrl: z.string().url("storefrontUrl must be a valid URL").optional(),
  /** Optional login credentials for login-gated storefronts */
  credentials: z
    .object({
      username: z.string().min(1).max(256),
      password: z.string().min(1).max(256),
    })
    .optional(),
  targetUnitPrice: z.number().positive().optional(),
  targetSubtotal: z.number().positive().optional(),
  varianceThresholdPct: z.number().min(0).max(100).default(10),
  discountCode: z.string().max(64).optional(),
  fallbackPolicy: FallbackPolicySchema.default("default_wholesale"),
});

export type GoalInput = z.infer<typeof GoalInputSchema>;

// ---------------------------------------------------------------------------
// Conversation — session-scoped memory for the intent gatekeeper
// The browser tab owns the thread: it sends prior turns with each /api/intent
// request. Nothing is persisted server-side and history never crosses into a
// task run (a new thread).
// ---------------------------------------------------------------------------

export const ConversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

export const IntentRequestSchema = GoalInputSchema.extend({
  history: z.array(ConversationTurnSchema).max(50).default([]),
});

export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export type IntentRequest = z.infer<typeof IntentRequestSchema>;

// ---------------------------------------------------------------------------
// Intent gatekeeper — POST /api/intent
// Every prompt is classified before a run is enqueued so chitchat never
// launches a browser session. The request body is a GoalInput; the response is
// one of three routes: CONVERSATIONAL (direct reply), CAPABILITY_QUERY (help),
// or AUTOMATION_TASK (a run was started and a runId returned).
// ---------------------------------------------------------------------------

export const UserIntentSchema = z.enum([
  "CONVERSATIONAL",
  "CAPABILITY_QUERY",
  "AUTOMATION_TASK",
]);

export const CapabilitySchema = z.object({
  title: z.string(),
  description: z.string(),
  example: z.string(),
});

export const CapabilityHelpSchema = z.object({
  intro: z.string(),
  capabilities: z.array(CapabilitySchema),
});

export const IntentResponseSchema = z.discriminatedUnion("intent", [
  z.object({ intent: z.literal("CONVERSATIONAL"), reply: z.string().min(1) }),
  z.object({ intent: z.literal("CAPABILITY_QUERY"), help: CapabilityHelpSchema }),
  z.object({ intent: z.literal("AUTOMATION_TASK"), runId: z.string().min(1) }),
]);

export type UserIntent = z.infer<typeof UserIntentSchema>;
export type IntentResponse = z.infer<typeof IntentResponseSchema>;
export type CapabilityHelp = z.infer<typeof CapabilityHelpSchema>;

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
  z.object({
    action: z.literal("custom"),
    instruction: z.string().min(1).max(500),
  }),
]);

export type ApprovalResolution = z.infer<typeof ApprovalResolutionSchema>;

// ---------------------------------------------------------------------------
// Live steering — validated on POST /api/runs/[runId]/steer (ADR-012)
// ---------------------------------------------------------------------------

export const SteerInstructionSchema = z.object({
  instruction: z.string().min(1, "An instruction is required").max(500),
});

export type SteerInstruction = z.infer<typeof SteerInstructionSchema>;

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

export const QuotaSnapshotSchema = z.object({
  enabled: z.boolean(),
  identity: z.literal("anonymous"),
  dailyUsed: z.number().nonnegative().int(),
  dailyLimit: z.number().int().positive(),
  active: z.number().nonnegative().int(),
  activeLimit: z.number().int().positive(),
  ipDailyUsed: z.number().nonnegative().int().optional(),
  ipDailyLimit: z.number().int().positive().nullable().optional(),
  ipActive: z.number().nonnegative().int().optional(),
  ipActiveLimit: z.number().int().positive().nullable().optional(),
  capacityOccupied: z.number().nonnegative().int().optional(),
  capacityLimit: z.number().int().positive().nullable().optional(),
  resetsAt: z.string().nullable(),
  canRun: z.boolean(),
  deny: z
    .object({ reason: z.string(), message: z.string() })
    .optional(),
});

export type QuotaSnapshot = z.infer<typeof QuotaSnapshotSchema>;

export type RunSummary = z.infer<typeof RunSummarySchema>;
export type ReconciliationReport = z.infer<typeof ReconciliationReportSchema>;
export type Discrepancy = z.infer<typeof DiscrepancySchema>;
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;
export type LineItem = z.infer<typeof LineItemSchema>;
