/**
 * worker/src/routes/resolve.ts
 *
 * POST /runs/:id/resolve
 *
 * Resolves a pending HITL (Human-In-The-Loop) price or coupon validation alert.
 * Publishes the action to Redis, releasing the blocked runner loop.
 */

import { Router, type Request, type Response } from "express";
import { signalHITLResolution } from "../storage/redis.js";
import type { ApprovalResolution } from "../types/index.js";

const router = Router();

router.post("/:id/resolve", async (req: Request, res: Response) => {
  const runId = req.params.id as string;
  const resolution = req.body as ApprovalResolution;

  if (!resolution || !resolution.action) {
    res.status(400).json({ error: "Missing action parameter" });
    return;
  }

  try {
    // Release the blocked runner by pushing to the Redis list
    await signalHITLResolution(runId, resolution);
    
    console.log(`[routes:resolve] Dispatched HITL signal for ${runId}:`, resolution);
    res.json({ ok: true });
  } catch (err: unknown) {
    console.error("[routes:resolve] Failed to signal resolution:", err);
    res.status(500).json({ error: "Failed to dispatch resolution signal to worker" });
  }
});

export default router;
