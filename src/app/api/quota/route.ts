/**
 * GET /api/quota
 *
 * Returns the anonymous visitor's execution allowance snapshot from the
 * worker. Display-only: the worker is the authority and the start action
 * re-checks quotas server-side on every run creation.
 */

import { NextRequest, NextResponse } from "next/server";
import { getQuota } from "@/server/worker-client";
import { getAnonymousId, getClientIp } from "@/server/identity";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const snapshot = await getQuota({
      anonymousId: getAnonymousId(request),
      ip: getClientIp(request),
    });
    return NextResponse.json(snapshot);
  } catch {
    // Quota display is best-effort: never break the goal screen because the
    // worker is cold-starting. The button simply stays enabled.
    return NextResponse.json({ error: "Failed to load quota" }, { status: 502 });
  }
}