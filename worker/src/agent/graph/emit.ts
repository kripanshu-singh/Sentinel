/**
 * worker/src/agent/graph/emit.ts
 *
 * Shared side-effect helpers for graph nodes.
 * Nodes never touch Postgres/Redis directly — they call these, which keep the
 * DB insert + Redis pub/sub (SSE) behavior identical to the old AgentRunner.
 */

import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";
import { db, agentEvents, runs } from "../../storage/db.js";
import { setRunStatus, publishEvent } from "../../storage/redis.js";
import { log } from "../../lib/logger.js";
import type { AgentEvent, AgentEventStatus, AgentEventType, RunStatus } from "../../types/index.js";

function getTimestamp(): string {
  const d = new Date();
  return d.toTimeString().split(" ")[0] ?? "";
}

/** Persist run status to Postgres + Redis cache. */
export async function transition(runId: string, status: RunStatus): Promise<void> {
  log("runner", "transition", { runId, status });
  await db.update(runs)
    .set({ status, updatedAt: new Date() })
    .where(eq(runs.runId, runId));
  await setRunStatus(runId, status);
}

/** Persist + publish a single AgentEvent, returning it for state accumulation. */
export async function emitEvent(
  runId: string,
  type: AgentEventType,
  title: string,
  detail: string,
  status: AgentEventStatus = "success",
  evidence?: Record<string, unknown>
): Promise<AgentEvent> {
  const event: AgentEvent = {
    id: nanoid(),
    runId,
    type,
    title,
    detail,
    timestamp: getTimestamp(),
    status,
    evidence,
  };

  log("emit", "event", { runId, type, status, title, detail, evidence });

  await db.insert(agentEvents).values({
    id: event.id,
    runId: event.runId,
    type: event.type,
    title: event.title,
    detail: event.detail,
    status: event.status,
    evidence: event.evidence,
    timestamp: event.timestamp,
  });

  await publishEvent(event);
  return event;
}
