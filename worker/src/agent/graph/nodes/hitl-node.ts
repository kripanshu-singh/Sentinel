/**
 * worker/src/agent/graph/nodes/hitl-node.ts
 *
 * HITL node — the human approval gate. Reached from `validate` when a discrepancy
 * is above the auto-approve threshold (`pendingHITL === true`).
 *
 * Mirrors the old AgentRunner block-for-resolution behavior: registers an
 * `approval_requests` row, blocks on the Redis BLPOP list (swappable for
 * LangGraph `interrupt()` later without graph changes), then routes by the
 * human's decision:
 *
 *   approve  → RESUME, continue the execute machine
 *   override → RESUME with a recomputed price check against the new target
 *   abort    → ABORTED (terminal, via `next: "end"`)
 */

import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db, approvalRequests } from "../../../storage/db.js";
import { waitForHITLResolution } from "../../../storage/redis.js";
import { recheck } from "../../rule-engine.js";
import { emitEvent, transition } from "../emit.js";
import type { ApprovalResolution } from "../../../types/index.js";
import type { SentinelStateUpdate, SentinelStateValue } from "../state.js";

export async function hitlNode(
  state: SentinelStateValue
): Promise<SentinelStateUpdate> {
  const { runId, input, currentProduct, discrepancies } = state;

  if (state.status === "FAILED" || state.status === "ABORTED") {
    return { next: "end" };
  }

  await transition(runId, "HITL_PENDING");

  const explicitGate = state.requiresApproval === true;
  const approvalId = nanoid();
  await db.insert(approvalRequests).values({
    id: approvalId,
    runId,
    title: explicitGate ? "Human approval required" : "Variance Alert",
    detail: explicitGate
      ? "The agent has paused and is waiting for your confirmation before proceeding."
      : `Variance check triggered for ${currentProduct?.product.description ?? "product"}`,
    discrepancies,
  });

  await emitEvent(
    runId,
    "HITL",
    explicitGate ? "Awaiting your confirmation" : "Variance above threshold",
    explicitGate
      ? "The agent has paused to ask for your approval before running the next step."
      : `Found $${currentProduct?.product.unitPrice ?? 0} - target $${input.targetUnitPrice ?? 0}. Exceeds threshold.`,
    "pending",
    {
      discrepancies,
      approvalId,
      screenshot: state.currentScreenshot ?? undefined,
      url: state.currentURL ?? undefined,
    }
  );

  // Block until the operator resolves via POST /runs/:id/resolve.
  const resolution: ApprovalResolution | null = await waitForHITLResolution(runId);

  await db
    .update(approvalRequests)
    .set({ resolution: resolution ?? { action: "abort" }, resolvedAt: new Date() })
    .where(eq(approvalRequests.id, approvalId));

  if (!resolution || resolution.action === "abort") {
    await transition(runId, "ABORTED");
    await emitEvent(runId, "HITL", "Run aborted", "Aborted by human operator.", "error");
    return {
      resolution: resolution ?? null,
      status: "ABORTED",
      pendingHITL: false,
      requiresApproval: false,
      next: "end",
    };
  }

  await transition(runId, "RESUME");

  if (resolution.action === "override" && resolution.overrideTarget != null) {
    if (currentProduct) {
      const updated = recheck(currentProduct.product, input, resolution.overrideTarget);
      await emitEvent(
        runId,
        "HITL",
        "Target overridden",
        `Operator set target to $${resolution.overrideTarget}`,
        "success",
        {
          discrepancies: updated.discrepancies,
          screenshot: state.currentScreenshot ?? undefined,
          url: state.currentURL ?? undefined,
        }
      );
      await emitEvent(
        runId,
        "CHECK",
        "Target overridden - rules satisfied",
        "Continuing task execution.",
        "success",
        { discrepancies: updated.discrepancies }
      );
      return {
        resolution,
        discrepancies: updated.discrepancies,
        status: "RESUME",
        pendingHITL: false,
        approvalHandled: true,
        requiresApproval: false,
        next: "execute",
      };
    }
    return {
      resolution,
      status: "RESUME",
      pendingHITL: false,
      approvalHandled: true,
      requiresApproval: false,
      next: "execute",
    };
  }

  await emitEvent(
    runId,
    "HITL",
    "Approved & Resumed",
    "Human operator accepted price discrepancy.",
    "success",
    {
      screenshot: state.currentScreenshot ?? undefined,
      url: state.currentURL ?? undefined,
    }
  );
  return {
    resolution,
    status: "RESUME",
    pendingHITL: false,
    approvalHandled: true,
    requiresApproval: false,
    next: "execute",
  };
}
