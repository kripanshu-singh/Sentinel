/**
 * POST /api/intent
 *
 * Intent gatekeeper. Classifies the prompt before any browser automation is
 * started. The request body is a GoalInput; the `goal` is classified into one
 * of three routes:
 *
 *   - CONVERSATIONAL   → returns a direct text reply (no run created)
 *   - CAPABILITY_QUERY → returns structured help + sample prompts
 *   - AUTOMATION_TASK  → validates business rules, enqueues a run, returns runId
 */

import { NextRequest, NextResponse } from "next/server";
import { IntentRequestSchema, IntentResponseSchema } from "@/server/schemas";
import { startRun, WorkerError } from "@/server/worker-client";
import { CAPABILITY_HELP, routeIntent } from "@/server/intent-classifier";
import { getAnonymousId, getClientIp } from "@/server/identity";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = IntentRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const decision = await routeIntent(parsed.data.goal, parsed.data.history);

  if (decision.intent === "AUTOMATION_TASK") {
    try {
      const result = await startRun(
        {
          goal: parsed.data.goal,
          storefrontUrl: parsed.data.storefrontUrl,
          credentials: parsed.data.credentials,
          targetUnitPrice: parsed.data.targetUnitPrice,
          targetSubtotal: parsed.data.targetSubtotal,
          varianceThresholdPct: parsed.data.varianceThresholdPct,
          discountCode: parsed.data.discountCode,
          fallbackPolicy: parsed.data.fallbackPolicy,
        },
        {
          anonymousId: getAnonymousId(request),
          ip: getClientIp(request),
        }
      );
      const response = IntentResponseSchema.parse({
        intent: "AUTOMATION_TASK",
        runId: result.runId,
      });
      return NextResponse.json(response, { status: 201 });
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

  if (decision.intent === "CAPABILITY_QUERY") {
    const response = IntentResponseSchema.parse({
      intent: "CAPABILITY_QUERY",
      help: CAPABILITY_HELP,
    });
    return NextResponse.json(response);
  }

  const response = IntentResponseSchema.parse({
    intent: "CONVERSATIONAL",
    reply:
      decision.reply ??
      "Nice to meet you. Please give me a browser task when you're ready.",
  });
  return NextResponse.json(response);
}
