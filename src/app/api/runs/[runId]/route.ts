/**
 * GET /api/runs/[runId]
 *
 * Fetches the current run summary (status + optional report) from the worker.
 * Used by React Query for run status polling and the result screen.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRun } from "@/server/worker-client";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(_request: NextRequest, ctx: RouteContext) {
  const { runId } = await ctx.params;

  try {
    const summary = await getRun(runId);
    return NextResponse.json(summary);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Worker unavailable";
    const status =
      (err as { statusCode?: number }).statusCode === 404 ? 404 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
