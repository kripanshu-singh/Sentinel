/**
 * src/server/identity.ts
 *
 * Anonymous visitor identity for the execution-limits feature. The browser
 * cookie is issued once by the Next.js proxy (src/proxy.ts) before scripts or
 * the goal screen load, so the server always has a stable trial counter.
 *
 * The guest cookie is only an identifier — the allowance itself is enforced in
 * the worker's quota counters (worker/src/quota.ts). Forging or clearing the
 * cookie gets a new identity, which is why the per-IP backstop and global
 * capacity ceiling exist. See context/rate-limiting-plan.md.
 */

import type { NextRequest } from "next/server";

export const ANONYMOUS_ID_COOKIE = "sentinel_anon";

/** The server-issued anonymous browser ID, if the cookie is present. */
export function getAnonymousId(request: NextRequest): string | undefined {
  return request.cookies.get(ANONYMOUS_ID_COOKIE)?.value;
}

/**
 * Best-effort client IP for the abuse backstop. On Vercel the platform sets
 * x-forwarded-for; local dev resolves to undefined, which the worker treats as
 * an unbounded IP backstop so development is never blocked by it.
 */
export function getClientIp(request: NextRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || undefined;
}