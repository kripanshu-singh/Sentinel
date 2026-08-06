/**
 * worker/src/routes/stream.ts
 *
 * GET /runs/:id/stream
 *
 * Server-Sent Events (SSE) route.
 * Streams real-time AgentEvents from Redis Pub/Sub down to client browsers.
 * Replays past events from database on connect to prevent data loss.
 */

import { Router, type Request, type Response } from "express";
import { db, agentEvents } from "../storage/db.js";
import { eq, asc } from "drizzle-orm";
import { subscribeToRun } from "../storage/redis.js";
import type { AgentEvent } from "../types/index.js";

const router = Router();

router.get("/:id/stream", async (req: Request, res: Response) => {
  const runId = req.params.id as string;

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  // Keep connection alive with comment pinpricks every 15s
  const keepAliveTimer = setInterval(() => {
    res.write(":\n\n");
  }, 15000);

  // 1. Replay historical events from PostgreSQL database first.
  // Helps client catch up on page reload or reconnect without losing context.
  try {
    const pastEvents = await db
      .select()
      .from(agentEvents)
      .where(eq(agentEvents.runId, runId))
      .orderBy(asc(agentEvents.createdAt));

    for (const row of pastEvents) {
      const event: AgentEvent = {
        id: row.id,
        runId: row.runId,
        type: row.type as any,
        title: row.title,
        detail: row.detail,
        timestamp: row.timestamp,
        status: row.status as any,
        evidence: (row.evidence as Record<string, unknown>) ?? undefined,
      };
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err: unknown) {
    console.error("[routes:stream] Error replaying history:", err);
  }

  // 2. Subscribe to new real-time events via Redis Pub/Sub
  const unsubscribe = subscribeToRun(runId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  // Clean up when client disconnects
  req.on("close", async () => {
    clearInterval(keepAliveTimer);
    await unsubscribe();
    res.end();
  });
});

export default router;
