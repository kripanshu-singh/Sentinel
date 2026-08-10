/**
 * POST /api/runs
 *
 * Validates a GoalInput payload with Zod and starts a new agent run via the worker.
 * Returns { runId } on success for the client to navigate to /runs/[runId].
 *
 * Forwards the anonymous browser identity so the worker can enforce execution
 * limits. A quota denial surfaces as 429 with the worker's message + snapshot.
 */

import { NextRequest, NextResponse } from "next/server";
import { GoalInputSchema } from "@/server/schemas";
import { startRun, WorkerError } from "@/server/worker-client";
import { getAnonymousId, getClientIp } from "@/server/identity";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = GoalInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    const result = await startRun(parsed.data, {
      anonymousId: getAnonymousId(request),
      ip: getClientIp(request),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof WorkerError) {
      if (err.statusCode === 429) {
        return NextResponse.json(
          { error: err.message, quota: err.quota ?? undefined },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode ?? 502 }
      );
    }
    const message = err instanceof Error ? err.message : "Worker unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}