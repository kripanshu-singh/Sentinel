/**
 * worker/src/jobs/hitl-sweeper.ts
 *
 * Abandoned-HITL recovery. A run that pauses at the HITL gate blocks on a
 * Redis BLPOP (`waitForHITLResolution`) while holding its BullMQ job in the
 * `active` state. With `SENTINEL_GLOBAL_ACTIVE_LIMIT=1`, one unanswered pause
 * consumes the whole capacity slot and blocks every other run — and a
 * `--watch` restart can re-enter the gate and re-arm the BLPOP timeout.
 *
 * This sweeper periodically finds runs stuck in `HITL_PENDING` longer than a
 * threshold and dispatches an `abort` resolution via `signalHITLResolution` —
 * the exact signal a human clicking "Abort" sends. The blocked node wakes,
 * runs its normal abort path (DB transition, approval record, event emit), the
 * graph finishes, and `releaseRun` frees the slot.
 *
 * Thresholds are env-tunable:
 *   SENTINEL_HITL_STALE_MINUTES      (default 15) — how long a pause may linger
 *   SENTINEL_HITL_SWEEPER_INTERVAL_MS (default 60_000) — sweep cadence
 *   SENTINEL_HITL_SWEEPER_ENABLED     ("false" disables; default on)
 */

import { and, lt, eq } from "drizzle-orm";
import { db, runs } from "../storage/db.js";
import { signalHITLResolution } from "../storage/redis.js";
import { log } from "../lib/logger.js";

const SWEEPER_ENABLED = process.env.SENTINEL_HITL_SWEEPER_ENABLED !== "false";
const STALE_MINUTES = Number(process.env.SENTINEL_HITL_STALE_MINUTES ?? 15);
const SWEEPER_INTERVAL_MS = Number(
  process.env.SENTINEL_HITL_SWEEPER_INTERVAL_MS ?? 60_000
);

const STALE_BATCH = 50;

/**
 * Find and abort HITL_PENDING runs that have been waiting too long.
 * Returns the run IDs aborted. Safe to call repeatedly and idempotent: a
 * second signal for an already-aborted run is a no-op for the (now finished)
 * node, and the orphaned list entry self-expires via its TTL.
 */
export async function sweepStaleHitlRuns(): Promise<string[]> {
  if (!SWEEPER_ENABLED) return [];

  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000);

  const stale = await db
    .select({ runId: runs.runId, updatedAt: runs.updatedAt })
    .from(runs)
    .where(and(eq(runs.status, "HITL_PENDING"), lt(runs.updatedAt, cutoff)))
    .limit(STALE_BATCH);

  const aborted: string[] = [];
  for (const run of stale) {
    try {
      await signalHITLResolution(run.runId, { action: "abort" });
      aborted.push(run.runId);
      log(
        "hitl-sweeper",
        `Aborting stale HITL run ${run.runId}`,
        { runId: run.runId, stuckSince: run.updatedAt.toISOString() }
      );
    } catch (err) {
      console.error(`[hitl-sweeper] Failed to signal abort for ${run.runId}:`, err);
    }
  }
  return aborted;
}

/**
 * Start the periodic sweeper. Uses an unref'd interval so it never keeps the
 * process alive on shutdown. When multiple worker instances share the queue,
 * each may sweep, but duplicate abort signals are harmless (idempotent).
 */
export function startStaleHitlSweeper(): NodeJS.Timeout {
  const timer = setInterval(() => {
    void sweepStaleHitlRuns().catch((err: unknown) => {
      console.error("[hitl-sweeper] Sweep failed:", err);
    });
  }, SWEEPER_INTERVAL_MS);

  timer.unref?.();
  return timer;
}
