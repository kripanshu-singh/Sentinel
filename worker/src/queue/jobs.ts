/**
 * worker/src/queue/jobs.ts
 *
 * BullMQ job queue setup for scheduling and executing runs.
 */

import { Queue, Worker, type Job } from "bullmq";
import { runGraph } from "../agent/graph/graph.js";
import { releaseRun } from "../quota.js";
import type { GoalInput } from "../types/index.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// ---------------------------------------------------------------------------
// Queue Setup
// ---------------------------------------------------------------------------

export const runsQueue = new Queue("runs", {
  connection: {
    url: REDIS_URL,
  },
});

// ---------------------------------------------------------------------------
// Worker Setup
// ---------------------------------------------------------------------------

// One concurrent Chromium by default: Playwright needs ~250–400MB per browser,
// and the Render free tier (512MB) cannot run more than one at a time. If the
// worker runs on a larger instance, raise WORKER_CONCURRENCY accordingly.
const DEFAULT_CONCURRENCY = 1;

export function startQueueWorker(): Worker {
  const concurrency = Number(process.env.WORKER_CONCURRENCY ?? DEFAULT_CONCURRENCY);

  const worker = new Worker(
    "runs",
    async (job: Job<{ runId: string; input: GoalInput }>) => {
      const { runId, input } = job.data;
      console.log(`[queue] Processing run job ${runId}`);

      try {
        await runGraph(runId, input);
      } finally {
        // The run ended (success, failure, or HITL resolution): free the
        // concurrency token. Leaked tokens self-expire via their TTL.
        await releaseRun(runId);
      }
    },
    {
      connection: {
        url: REDIS_URL,
      },
      concurrency, // Process up to N runs concurrently (see WORKER_CONCURRENCY)
    }
  );

  worker.on("completed", (job: Job) => {
    console.log(`[queue] Job ${job.id} completed successfully`);
  });

  worker.on("failed", async (job: Job | undefined, err: Error) => {
    console.error(`[queue] Job ${job?.id} failed:`, err.message);
    if (job?.id) await releaseRun(job.id);
  });

  return worker;
}
