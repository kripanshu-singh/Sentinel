/**
 * worker/src/routes/runs.ts
 *
 * Express route handlers for starting runs and retrieving summaries.
 */

import { Router, type Request, type Response } from "express";
import { nanoid } from "nanoid";
import { db, runs, agentEvents, approvalRequests, reconciliationReports } from "../storage/db.js";
import { eq, and, isNull } from "drizzle-orm";
import { runsQueue } from "../queue/jobs.js";
import { extractTargetPrice, extractTargetSubtotal } from "../lib/goal-rules.js";
import { reserveRun, releaseRun, getQuotaSnapshot, quotaDenialMessage } from "../quota.js";
import type { GoalInput, RunSummary } from "../types/index.js";

const router = Router();

/**
 * Soft ceiling on active + queued + delayed jobs, independent of identity.
 * Matches the single-Chromium limit of the Render free worker by default; the
 * queue absorbs extra attempts via 429 instead of piling up unstartable jobs.
 */
export const GLOBAL_ACTIVE_LIMIT = Number(process.env.SENTINEL_GLOBAL_ACTIVE_LIMIT ?? 1);

function identityFrom(headers: Record<string, string | string[] | undefined>): {
  anonymousId?: string;
  ip?: string;
} {
  const header = (name: string): string | undefined => {
    const value = headers[name];
    if (Array.isArray(value)) return String(value[0] ?? "").trim() || undefined;
    return String(value ?? "").trim() || undefined;
  };
  return {
    anonymousId: header("x-anonymous-id"),
    ip: header("x-client-ip"),
  };
}

// ---------------------------------------------------------------------------
// POST /runs — Start a new run
// ---------------------------------------------------------------------------
router.post("/", async (req: Request, res: Response) => {
  const input = req.body as GoalInput;

  if (!input || !input.goal) {
    res.status(400).json({ error: "Missing goal parameter" });
    return;
  }

  const runId = `PRQ-${nanoid(6).toUpperCase()}`;

  // Derive the target price from the prompt when the caller didn't set one
  // explicitly (e.g. "If the price is higher than $25, pause and ask for
  // approval" → targetUnitPrice = 25).
  const targetUnitPrice = input.targetUnitPrice ?? extractTargetPrice(input.goal);
  const targetSubtotal = input.targetSubtotal ?? extractTargetSubtotal(input.goal);

  const { anonymousId, ip } = identityFrom(req.headers);

  try {
    // 0. Global capacity guard: never enqueue past the worker's total ceiling.
    // This bounds cost even when an attacker keeps rotating fresh identities.
    const counts = await runsQueue.getJobCounts();
    const occupying =
      (counts.active ?? 0) + (counts.waiting ?? 0) + (counts.delayed ?? 0);
    if (occupying >= GLOBAL_ACTIVE_LIMIT) {
      res.status(429).json({
        error: quotaDenialMessage("CAPACITY"),
        reason: "CAPACITY",
        quota: await getQuotaSnapshot(
          { anonymousId, ip },
          { occupied: occupying, limit: GLOBAL_ACTIVE_LIMIT }
        ),
      });
      return;
    }

    // 1. Atomic quota reserve (per-ID trial + per-IP backstop + concurrency).
    const decision = await reserveRun({ anonymousId, ip }, runId);
    if (!decision.ok) {
      res.status(429).json({
        error: quotaDenialMessage(decision.reason),
        reason: decision.reason,
        quota: decision.snapshot,
      });
      return;
    }

    // 2. Create run record in Database
    await db.insert(runs).values({
      runId,
      goal: input.goal,
      status: "PENDING",
      targetUnitPrice,
      targetSubtotal,
      varianceThresholdPct: input.varianceThresholdPct,
      discountCode: input.discountCode,
      fallbackPolicy: input.fallbackPolicy,
      anonymousId,
    });

    // 3. Add job to Queue
    await runsQueue.add(runId, { runId, input: { ...input, targetUnitPrice, targetSubtotal } });

    res.status(201).json({ runId });
  } catch (err: unknown) {
    // Dispatch failed before a run was created/queued: release the reservation
    // so the visitor is not charged for a run that never started.
    await releaseRun(runId);
    console.error("[routes:runs] Failed to create run:", err);
    res.status(500).json({ error: "Failed to initialize run record" });
  }
});

// ---------------------------------------------------------------------------
// GET /runs/:id — Fetch summary + final report
// ---------------------------------------------------------------------------
router.get("/:id", async (req: Request, res: Response) => {
  const runId = req.params.id as string;

  try {
    // 1. Get run record
    const runRows = await db.select().from(runs).where(eq(runs.runId, runId)).limit(1);
    const run = runRows[0];

    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    // 2. Load optional report
    const reportRows = await db
      .select()
      .from(reconciliationReports)
      .where(eq(reconciliationReports.runId, runId))
      .limit(1);
    
    // 3. Load ACTIVE approval request if the run is paused (unresolved only).
    const approvalRows = await db
      .select()
      .from(approvalRequests)
      .where(and(eq(approvalRequests.runId, runId), isNull(approvalRequests.resolution)))
      .limit(1);

    const summary: RunSummary = {
      runId: run.runId,
      status: run.status as any,
      goal: run.goal,
      createdAt: run.createdAt.toISOString(),
      updatedAt: run.updatedAt.toISOString(),
      report: reportRows[0] ? {
        runId: reportRows[0].runId,
        generatedAt: reportRows[0].generatedAt.toISOString(),
        items: reportRows[0].items as any[],
        discrepancies: reportRows[0].discrepancies as any[],
        channels: reportRows[0].channels as any[] ?? [],
        summary: reportRows[0].summary,
      } : undefined,
      currentApprovalRequest: approvalRows[0] ? {
        id: approvalRows[0].id,
        runId: approvalRows[0].runId,
        title: approvalRows[0].title,
        detail: approvalRows[0].detail,
        discrepancies: approvalRows[0].discrepancies as any[],
        resolution: approvalRows[0].resolution as any ?? undefined,
      } : undefined,
    };

    res.json(summary);
  } catch (err: unknown) {
    console.error("[routes:runs] Failed to fetch run:", err);
    res.status(500).json({ error: "Database error" });
  }
});

// ---------------------------------------------------------------------------
// POST /runs/:id/cancel — Cancel run
// ---------------------------------------------------------------------------
router.post("/:id/cancel", async (req: Request, res: Response) => {
  const runId = req.params.id as string;

  try {
    await db.update(runs).set({ status: "ABORTED", updatedAt: new Date() }).where(eq(runs.runId, runId));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to abort run" });
  }
});

export default router;
