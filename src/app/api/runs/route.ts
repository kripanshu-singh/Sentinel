/**
 * POST /api/runs
 *
 * Validates a GoalInput payload with Zod and starts a new agent run via the worker.
 * Returns { runId } on success for the client to navigate to /runs/[runId].
 */

import { NextRequest, NextResponse } from "next/server";
import { GoalInputSchema } from "@/server/schemas";
import { startRun } from "@/server/worker-client";

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
    const result = await startRun(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Worker unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
