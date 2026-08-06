/**
 * GET /api/runs/[runId]/stream
 *
 * Proxies the SSE event stream from the worker to the browser.
 * - Passes `Last-Event-ID` through for reconnect safety.
 * - Streams the response body directly without buffering.
 */

import { NextRequest } from "next/server";
import { openEventStream } from "@/server/worker-client";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ runId: string }>;
}

export async function GET(request: NextRequest, ctx: RouteContext) {
  const { runId } = await ctx.params;
  const lastEventId = request.headers.get("Last-Event-ID") ?? undefined;

  let workerStream: Response;
  try {
    workerStream = await openEventStream(runId, lastEventId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stream unavailable";
    return new Response(
      `data: ${JSON.stringify({ error: message })}\n\n`,
      {
        status: 502,
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }

  // Pipe the worker's SSE response body straight to the browser.
  return new Response(workerStream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
