/**
 * worker/src/routes/steer.ts
 *
 * POST /runs/:id/steer
 *
 * Live steering (ADR-012). Accepts a free-form operator instruction and queues
 * it on the run's Redis steer list. The `execute` node drains the queue at the
 * next step boundary and folds the instruction into the plan via the `replan`
 * node (treated as the highest-priority requirement). Acknowledged on the SSE
 * timeline as a `STEER` event.
 *
 * Steers for terminal runs (DONE / FAILED / ABORTED) are rejected — there is no
 * step boundary left to honor them.
 */

import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, runs } from "../storage/db.js";
import { queueSteer } from "../storage/redis.js";

const router = Router();

const TERMINAL_STATUSES = new Set(["DONE", "FAILED", "ABORTED"]);

router.post("/:id/steer", async (req: Request, res: Response) => {
  const runId = req.params.id as string;
  const instruction =
    typeof req.body?.instruction === "string" ? req.body.instruction.trim() : "";

  if (!instruction) {
    res.status(400).json({ error: "Missing instruction parameter" });
    return;
  }
  if (instruction.length > 500) {
    res.status(422).json({ error: "Instruction must be 500 characters or fewer" });
    return;
  }

  try {
    const runRows = await db.select().from(runs).where(eq(runs.runId, runId)).limit(1);
    const run = runRows[0];
    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }
    if (TERMINAL_STATUSES.has(run.status)) {
      res.status(409).json({ error: "Cannot steer a completed run" });
      return;
    }

    await queueSteer(runId, instruction);
    console.log(`[routes:steer] Queued instruction for ${runId}:`, instruction);
    res.json({ ok: true });
  } catch (err: unknown) {
    console.error("[routes:steer] Failed to queue instruction:", err);
    res.status(500).json({ error: "Failed to queue instruction" });
  }
});

export default router;