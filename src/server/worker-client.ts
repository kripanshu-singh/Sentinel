/**
 * src/server/worker-client.ts
 *
 * Thin HTTP/SSE client that talks to the worker service.
 * All methods validate worker responses with Zod before returning.
 * Only imported in server-side code (API routes, server actions).
 */

import {
  RunSummarySchema,
  StartRunResponseSchema,
  WorkerSuccessResponseSchema,
  QuotaSnapshotSchema,
  type RunSummary,
  type QuotaSnapshot,
} from "./schemas";
import type { GoalInput, ApprovalResolution } from "./schemas";

const DEFAULT_WORKER_URL = "http://127.0.0.1:3001";
const WORKER_REQUEST_TIMEOUT_MS = 15_000;

export class WorkerError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    /** Present when the worker denied a run with a quota snapshot. */
    public readonly quota?: QuotaSnapshot | null
  ) {
    super(message);
    this.name = "WorkerError";
  }
}

/** Identity forwarded from the browser cookie so the worker can enforce quotas. */
export interface RunRequestContext {
  anonymousId?: string;
  ip?: string;
}

function getWorkerUrl(path: string): string {
  const workerUrl = process.env.WORKER_URL?.trim() || DEFAULT_WORKER_URL;

  try {
    const normalizedWorkerUrl = new URL(workerUrl);
    normalizedWorkerUrl.pathname = normalizedWorkerUrl.pathname.replace(/\/$/, "");
    return new URL(path, normalizedWorkerUrl).toString();
  } catch {
    throw new WorkerError("WORKER_URL must be a valid absolute URL");
  }
}

async function workerErrorMessage(response: Response): Promise<{
  message: string;
  quota?: QuotaSnapshot | null;
}> {
  const fallbackMessage = `Worker responded with ${response.status}`;
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return { message: fallbackMessage };
  }

  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string"
    ) {
      const quotaCandidate =
        typeof body === "object" && body !== null && "quota" in body
          ? body.quota
          : undefined;
      const quota = QuotaSnapshotSchema.safeParse(quotaCandidate).success
        ? QuotaSnapshotSchema.parse(quotaCandidate)
        : undefined;
      return { message: body.error, quota };
    }
  } catch {
    return { message: fallbackMessage };
  }

  return { message: fallbackMessage };
}

async function workerFetch(
  path: string,
  init?: RequestInit & { disableTimeout?: boolean }
): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const { disableTimeout, ...fetchInit } = init ?? {};

  let response: Response;
  try {
    response = await fetch(getWorkerUrl(path), {
      ...fetchInit,
      headers,
      signal:
        fetchInit.signal ??
        (disableTimeout ? undefined : AbortSignal.timeout(WORKER_REQUEST_TIMEOUT_MS)),
    });
  } catch (error: unknown) {
    if (error instanceof WorkerError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new WorkerError(
        `Worker request timed out after ${WORKER_REQUEST_TIMEOUT_MS / 1_000} seconds`
      );
    }

    throw new WorkerError(
      "Worker service is unavailable. Check WORKER_URL and start the Sentinel worker."
    );
  }

  if (!response.ok) {
    const { message, quota } = await workerErrorMessage(response);
    throw new WorkerError(message, response.status, quota);
  }

  return response;
}

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

/** Headers that carry the anonymous identity to the worker's quota authority. */
function identityHeaders(ctx?: RunRequestContext): [string, string][] {
  const headers: [string, string][] = [];
  if (ctx?.anonymousId) headers.push(["x-anonymous-id", ctx.anonymousId]);
  if (ctx?.ip) headers.push(["x-client-ip", ctx.ip]);
  return headers;
}

/**
 * Start a new agent run. Returns the generated runId.
 * Passes the visitor's anonymous identity so the worker can enforce quotas.
 */
export async function startRun(
  input: GoalInput,
  ctx?: RunRequestContext
): Promise<{ runId: string }> {
  const res = await workerFetch("/runs", {
    method: "POST",
    headers: identityHeaders(ctx),
    body: JSON.stringify(input),
  });
  return StartRunResponseSchema.parse(await res.json());
}

/**
 * Fetch the current quota snapshot for the anonymous visitor (display only —
 * the worker remains the authority).
 */
export async function getQuota(ctx?: RunRequestContext): Promise<QuotaSnapshot> {
  const res = await workerFetch("/quota", { headers: identityHeaders(ctx) });
  return QuotaSnapshotSchema.parse(await res.json());
}

/**
 * Fetch the current summary (status + optional report) for a run.
 */
export async function getRun(runId: string): Promise<RunSummary> {
  const res = await workerFetch(`/runs/${encodeURIComponent(runId)}`);
  const data = await res.json();
  return RunSummarySchema.parse(data);
}

/**
 * Cancel an in-progress run.
 */
export async function cancelRun(runId: string): Promise<void> {
  const res = await workerFetch(`/runs/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
  });
  WorkerSuccessResponseSchema.parse(await res.json());
}

// ---------------------------------------------------------------------------
// HITL resolution
// ---------------------------------------------------------------------------

/**
 * Send a human approval decision (approve / override / abort) to the worker.
 * The worker unblocks the paused agent step and resumes (or aborts) the run.
 */
export async function resolveHITL(
  runId: string,
  resolution: ApprovalResolution
): Promise<void> {
  const res = await workerFetch(`/runs/${encodeURIComponent(runId)}/resolve`, {
    method: "POST",
    body: JSON.stringify(resolution),
  });
  WorkerSuccessResponseSchema.parse(await res.json());
}

// ---------------------------------------------------------------------------
// Live steering (ADR-012)
// ---------------------------------------------------------------------------

/**
 * Send a free-form steer instruction to the worker. The `execute` node drains
 * the per-run steer queue at step boundaries and folds it into the plan via the
 * replan node. Acknowledged on the timeline as a `STEER` event.
 */
export async function sendSteer(
  runId: string,
  instruction: string
): Promise<void> {
  const res = await workerFetch(`/runs/${encodeURIComponent(runId)}/steer`, {
    method: "POST",
    body: JSON.stringify({ instruction }),
  });
  WorkerSuccessResponseSchema.parse(await res.json());
}

// ---------------------------------------------------------------------------
// Worker wake (Render free-tier spin-down)
// ---------------------------------------------------------------------------

/**
 * Best-effort ping of the worker's /health endpoint. Used to wake a spun-down
 * Render free instance on the first visitor. Never throws.
 */
export async function pingWorkerHealth(): Promise<void> {
  try {
    await workerFetch("/health", { signal: AbortSignal.timeout(5_000) });
  } catch {
    // Ignore: the worker may be asleep/cold-starting.
  }
}

// ---------------------------------------------------------------------------
// SSE stream proxy
// ---------------------------------------------------------------------------

/**
 * Opens an SSE stream to the worker for the given run.
 * Returns the raw Response so the Next.js API route can pipe it to the browser.
 *
 * Passes the `Last-Event-ID` header through so the worker can replay missed events.
 */
export async function openEventStream(
  runId: string,
  lastEventId?: string
): Promise<Response> {
  const headers = new Headers({ Accept: "text/event-stream" });
  if (lastEventId) headers.set("Last-Event-ID", lastEventId);

  return workerFetch(`/runs/${encodeURIComponent(runId)}/stream`, {
    headers,
    disableTimeout: true,
  });
}
