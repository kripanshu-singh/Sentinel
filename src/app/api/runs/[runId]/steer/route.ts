/**
 * POST /api/runs/[runId]/steer
 *
 * Live steering (ADR-012). Accepts a free-form operator instruction and forwards
 * it to the worker, which drains it at the next execute step boundary and folds
 * it into the plan via the replan node. Acknowledged on the timeline as a `STEER`
 * event.
 */

import { NextRequest, NextResponse } from "next/server";
import { SteerInstructionSchema } from "@/server/schemas";
import { sendSteer } from "@/server/worker-client";

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

  const parsed = SteerInstructionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  try {
    await sendSteer(runId, parsed.data.instruction);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Worker unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}