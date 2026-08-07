import { NextResponse } from "next/server";

import { pingWorkerHealth } from "@/server/worker-client";

export async function GET(): Promise<NextResponse> {
  await pingWorkerHealth();
  return NextResponse.json({ ok: true });
}