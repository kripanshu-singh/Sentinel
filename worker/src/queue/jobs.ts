/**
 * worker/src/queue/jobs.ts
 *
 * BullMQ job queue setup for scheduling and executing runs.
 */

import { Queue, Worker, type Job } from "bullmq";
import { AgentRunner } from "../agent/runner.js";
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

export function startQueueWorker(): Worker {
  const worker = new Worker(
    "runs",
    async (job: Job<{ runId: string; input: GoalInput }>) => {
      const { runId, input } = job.data;
      console.log(`[queue] Processing run job ${runId}`);
      
      const runner = new AgentRunner(runId, input);
      await runner.run();
    },
    {
      connection: {
        url: REDIS_URL,
      },
      concurrency: 5, // Process up to 5 runs concurrently
    }
  );

  worker.on("completed", (job: Job) => {
    console.log(`[queue] Job ${job.id} completed successfully`);
  });

  worker.on("failed", (job: Job | undefined, err: Error) => {
    console.error(`[queue] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
