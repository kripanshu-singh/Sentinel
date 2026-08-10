/**
 * src/proxy.ts — Next.js 16 Proxy (formerly Middleware).
 *
 * Issues the long-lived anonymous browser ID cookie on a visitor's first
 * request, at the network edge (before any page, API route, or RSC request is
 * handled). The cookie is HttpOnly + SameSite=Lax and never trusted for
 * entitlement — the worker enforces all allowances server-side.
 *
 * See context/rate-limiting-plan.md ("Why an anonymous browser ID is needed").
 */

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ANONYMOUS_ID_COOKIE } from "@/server/identity";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest) {
  if (request.cookies.has(ANONYMOUS_ID_COOKIE)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set({
    name: ANONYMOUS_ID_COOKIE,
    value: randomUUID(),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_YEAR_SECONDS,
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};