/**
 * worker/src/routes/quota.ts
 *
 * Read-only quota snapshot for the frontend's "runs remaining" display.
 * The worker owns quota records; the Next.js app proxies this and never
 * decides the allowance itself.
 */

import { Router } from "express";
import { getQuotaSnapshot } from "../quota.js";
import { runsQueue } from "../queue/jobs.js";
import { GLOBAL_ACTIVE_LIMIT } from "./runs.js";

const router = Router();

router.get("/", async (req, res) => {
  const anonymousId =
    String(req.headers["x-anonymous-id"] ?? "").trim() || undefined;
  const ip = String(req.headers["x-client-ip"] ?? "").trim() || undefined;

  try {
    const counts = await runsQueue.getJobCounts();
    const occupied =
      (counts.active ?? 0) + (counts.waiting ?? 0) + (counts.delayed ?? 0);
    const snapshot = await getQuotaSnapshot(
      { anonymousId, ip },
      { occupied, limit: GLOBAL_ACTIVE_LIMIT }
    );
    res.json(snapshot);
  } catch (err) {
    console.error("[routes:quota] Failed to read quota:", err);
    res.status(500).json({ error: "Failed to read quota" });
  }
});

export default router;