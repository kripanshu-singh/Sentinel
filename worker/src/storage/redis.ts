/**
 * worker/src/storage/redis.ts
 *
 * ioredis client + pub/sub helpers.
 *
 * Responsibilities:
 * - Shared Redis client for BullMQ, run state, and pub/sub.
 * - Channel naming convention for SSE fan-out.
 * - Pub/sub: publisher pushes AgentEvents; subscribers (SSE routes) relay them.
 * - Run state: ephemeral key-value store for HITL resolution signals.
 */

import Redis from "ioredis";
import type { AgentEvent, ApprovalResolution } from "../types/index.js";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

/** Shared client for all non-blocking operations (get/set/publish/etc.) */
export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null, // required by BullMQ
  lazyConnect: false,
});

/** Dedicated subscriber client — a subscribed client can't run other commands */
export const redisSub = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  lazyConnect: false,
});

redis.on("error", (err: any) => console.error("[redis] client error:", err.message));
redisSub.on("error", (err: any) => console.error("[redis] sub error:", err.message));

// ---------------------------------------------------------------------------
// Channel names
// ---------------------------------------------------------------------------

/** Pub/sub channel for a run's AgentEvents (SSE fan-out) */
export function runChannel(runId: string): string {
  return `run:${runId}:events`;
}

/** Key for HITL resolution signal (HITL_PENDING → resolution arrives) */
export function hitlKey(runId: string): string {
  return `run:${runId}:hitl`;
}

// ---------------------------------------------------------------------------
// Run state
// ---------------------------------------------------------------------------

/** Save the entire run status to Redis (ephemeral; 24h TTL) */
export async function setRunStatus(runId: string, status: string): Promise<void> {
  await redis.set(`run:${runId}:status`, status, "EX", 86400);
}

export async function getRunStatus(runId: string): Promise<string | null> {
  return redis.get(`run:${runId}:status`);
}

// ---------------------------------------------------------------------------
// AgentEvent pub/sub
// ---------------------------------------------------------------------------

/**
 * Publish an AgentEvent to the run's channel.
 * The SSE route subscribes and fans it to browser clients.
 */
export async function publishEvent(event: AgentEvent): Promise<void> {
  const channel = runChannel(event.runId);
  await redis.publish(channel, JSON.stringify(event));
}

/**
 * Subscribe to a run's event channel.
 * Calls `onEvent` for every AgentEvent received.
 * Returns an unsubscribe function to clean up.
 */
export function subscribeToRun(
  runId: string,
  onEvent: (event: AgentEvent) => void
): () => Promise<void> {
  const channel = runChannel(runId);

  const listener = (_channel: string, message: string) => {
    try {
      const event = JSON.parse(message) as AgentEvent;
      onEvent(event);
    } catch {
      /* ignore malformed messages */
    }
  };

  // ioredis: create a dedicated subscriber instance per subscription
  const sub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  sub.subscribe(channel);
  sub.on("message", listener);

  return async () => {
    await sub.unsubscribe(channel);
    sub.disconnect();
  };
}

// ---------------------------------------------------------------------------
// HITL pause / resume
// ---------------------------------------------------------------------------

/**
 * Block-wait for a HITL resolution on this run.
 * The runner calls this when it reaches HITL_PENDING; it blocks until
 * the resolution route writes the key.
 *
 * Uses BLPOP on a list key (safe for long-running workers).
 * Returns the resolution payload or null on timeout.
 */
export async function waitForHITLResolution(
  runId: string,
  timeoutSeconds = 3600
): Promise<ApprovalResolution | null> {
  const key = hitlKey(runId);
  // BLPOP blocks its connection, so it needs a dedicated client: if it ran on
  // the shared `redis` client, `signalHITLResolution` (rpush from the /resolve
  // route) would queue behind the blocking command and never reach the server
  // until the timeout. Dedicated connection breaks that deadlock.
  const blocker = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  try {
    // BLPOP blocks until an element is pushed or timeout expires
    const result = await blocker.blpop(key, timeoutSeconds);
    if (!result) return null;
    const [, payload] = result;
    try {
      return JSON.parse(payload) as ApprovalResolution;
    } catch {
      return null;
    }
  } finally {
    blocker.disconnect();
  }
}

/**
 * Signal a waiting HITL_PENDING runner with the human's resolution.
 * Called by the resolve API route.
 */
export async function signalHITLResolution(
  runId: string,
  resolution: ApprovalResolution
): Promise<void> {
  const key = hitlKey(runId);
  await redis.rpush(key, JSON.stringify(resolution));
  // TTL so orphaned keys don't accumulate
  await redis.expire(key, 3600);
}
