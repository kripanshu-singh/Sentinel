/**
 * POST /api/runs/[runId]/resolve
 *
 * Accepts a human approval decision (approve / override / abort) and forwards it
 * to the worker, which unblocks the paused HITL_PENDING agent step.
 */

import { NextRequest, NextResponse } from "next/server";
import { ApprovalResolutionSchema } from "@/server/schemas";
import { resolveHITL } from "@/server/worker-client";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function POST(request: NextRequest, ctx: RouteContext) {
  const { runId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = ApprovalResolutionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    await resolveHITL(runId, parsed.data);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Worker unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
