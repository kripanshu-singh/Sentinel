/**
 * worker/src/routes/quota.ts
 *
 * Read-only quota snapshot for the frontend's "runs remaining" display.
 * The worker owns quota records; the Next.js app proxies this and never
 * decides the allowance itself.
 */

import { Router } from "express";
import { getQuotaSnapshot } from "../quota.js";

const router = Router();

router.get("/", async (req, res) => {
  const anonymousId =
    String(req.headers["x-anonymous-id"] ?? "").trim() || undefined;
  const ip = String(req.headers["x-client-ip"] ?? "").trim() || undefined;

  try {
    const snapshot = await getQuotaSnapshot({ anonymousId, ip });
    res.json(snapshot);
  } catch (err) {
    console.error("[routes:quota] Failed to read quota:", err);
    res.status(500).json({ error: "Failed to read quota" });
  }
});

export default router;