/**
 * worker/src/routes/runs.ts
 *
 * Express route handlers for starting runs and retrieving summaries.
 */

import { Router, type Request, type Response } from "express";
import { nanoid } from "nanoid";
import { db, runs, agentEvents, approvalRequests, reconciliationReports } from "../storage/db.js";
import { eq } from "drizzle-orm";
import { runsQueue } from "../queue/jobs.js";
import { extractTargetPrice, extractTargetSubtotal } from "../lib/goal-rules.js";
import type { GoalInput, RunSummary } from "../types/index.js";

const router = Router();

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

  try {
    // 1. Create run record in Database
    await db.insert(runs).values({
      runId,
      goal: input.goal,
      status: "PENDING",
      targetUnitPrice,
      targetSubtotal,
      varianceThresholdPct: input.varianceThresholdPct,
      discountCode: input.discountCode,
      fallbackPolicy: input.fallbackPolicy,
    });

    // 2. Add job to Queue
    await runsQueue.add(runId, { runId, input: { ...input, targetUnitPrice, targetSubtotal } });

    res.status(201).json({ runId });
  } catch (err: unknown) {
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
    
    // 3. Load active approval request if paused
    const approvalRows = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.runId, runId))
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
