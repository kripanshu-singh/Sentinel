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
import { GoalInputSchema, IntentResponseSchema } from "@/server/schemas";
import { startRun } from "@/server/worker-client";
import {
  CAPABILITY_HELP,
  classifyIntent,
  conversationalReply,
} from "@/server/intent-classifier";

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

  const intent = await classifyIntent(parsed.data.goal);

  if (intent === "AUTOMATION_TASK") {
    try {
      const result = await startRun(parsed.data);
      const response = IntentResponseSchema.parse({
        intent: "AUTOMATION_TASK",
        runId: result.runId,
      });
      return NextResponse.json(response, { status: 201 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Worker unavailable";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  if (intent === "CAPABILITY_QUERY") {
    const response = IntentResponseSchema.parse({
      intent: "CAPABILITY_QUERY",
      help: CAPABILITY_HELP,
    });
    return NextResponse.json(response);
  }

  const response = IntentResponseSchema.parse({
    intent: "CONVERSATIONAL",
    reply: conversationalReply(parsed.data.goal),
  });
  return NextResponse.json(response);
}
