/**
 * worker/src/quota.ts
 *
 * Execution cost protection, per context/rate-limiting-plan.md.
 *
 * The worker owns the quota records because it owns job dispatch and the
 * durable run data. The Next.js app only forwards identity headers
 * (x-anonymous-id from the browser cookie, x-client-ip from the platform).
 *
 * Layered model:
 *   - Per-anonymous-browser-ID trial allowance (default: 1 run / UTC day).
 *   - Per-IP abuse backstop (default: 50 runs / UTC day). IP is a backstop,
 *     never an identity — several real humans may share one network.
 *   - Concurrency caps per ID and per IP (active runs currently reserved).
 *   - A global capacity ceiling is enforced by the run route against the
 *     BullMQ queue counts, independently of identity.
 *
 * The reserve step is a single atomic Redis Lua script so racing requests
 * (multiple tabs, concurrent dispatches) can never overdraw an allowance.
 * The run route releases a failed reservation so a non-run is never charged.
 */

import { createHash } from "node:crypto";
import { redis } from "./storage/redis.js";

// ---------------------------------------------------------------------------
// Configuration (env-tunable; tune after observing real traffic)
// ---------------------------------------------------------------------------

// Quota enforcement fails closed in production. In development it is off by
// default so local iteration never trips the trial limit; set
// SENTINEL_QUOTA_ENABLED=true to exercise the feature locally.
const QUOTA_ENABLED =
  process.env.NODE_ENV === "production"
    ? process.env.SENTINEL_QUOTA_ENABLED !== "false"
    : process.env.SENTINEL_QUOTA_ENABLED === "true";

const ANONYMOUS_DAILY_LIMIT = Number(process.env.SENTINEL_ANON_DAILY_LIMIT ?? 1);
const ANONYMOUS_ACTIVE_LIMIT = Number(process.env.SENTINEL_ANON_ACTIVE_LIMIT ?? 1);
const IP_DAILY_LIMIT = Number(process.env.SENTINEL_IP_DAILY_LIMIT ?? 50);
const IP_ACTIVE_LIMIT = Number(process.env.SENTINEL_IP_ACTIVE_LIMIT ?? 1);
const RUN_ACTIVE_TTL_SECONDS = Number(process.env.SENTINEL_RUN_MAX_SECONDS ?? 4 * 3600);

/** When no limit is configured for an identity dimension, effectively unbounded. */
const UNBOUNDED = 1_000_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type QuotaReasonCode =
  | "ANONYMOUS_DAILY"
  | "ANONYMOUS_ACTIVE"
  | "IP_DAILY"
  | "IP_ACTIVE"
  | "CAPACITY"
  | "MISSING_IDENTITY";

export interface QuotaIdentity {
  anonymousId?: string;
  ip?: string;
}

export interface QuotaSnapshot {
  enabled: boolean;
  identity: "anonymous";
  dailyUsed: number;
  dailyLimit: number;
  active: number;
  activeLimit: number;
  resetsAt: string | null;
  canRun: boolean;
}

export interface QuotaDecision {
  ok: boolean;
  reason?: QuotaReasonCode;
  snapshot: QuotaSnapshot;
}

// ---------------------------------------------------------------------------
// Key scheme
// ---------------------------------------------------------------------------

function utcDay(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Next UTC midnight, the fixed daily-reset boundary surfaced in the UI. */
function nextUtcMidnight(): string {
  const now = new Date();
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  );
  return next.toISOString();
}

function secondsUntilUtcMidnight(): number {
  return Math.max(1, Math.floor((new Date(nextUtcMidnight()).getTime() - Date.now()) / 1000));
}

/** Stability-hash the IP so raw addresses never sit in counter keys. */
function ipHash(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

function clientDailyKey(anonymousId: string): string {
  return `quota:day:anon:${anonymousId}:${utcDay()}`;
}

function clientActiveKey(anonymousId: string): string {
  return `quota:active:anon:${anonymousId}`;
}

function ipDailyKey(ip: string): string {
  return `quota:day:ip:${ipHash(ip)}:${utcDay()}`;
}

function ipActiveKey(ip: string): string {
  return `quota:active:ip:${ipHash(ip)}`;
}

function runScopeKey(runId: string): string {
  return `quota:runscope:${runId}`;
}

// ---------------------------------------------------------------------------
// Atomic reserve — single Lua script, single round trip
// ---------------------------------------------------------------------------

const RESERVE_LUA = `
local function activeCount(key)
  local n = redis.call('SCARD', key)
  if type(n) ~= 'number' then return 0 end
  return n
end

local clientDaily = tonumber(redis.call('GET', KEYS[1]) or '0')
local clientActive = activeCount(KEYS[2])
local ipDaily = tonumber(redis.call('GET', KEYS[3]) or '0')
local ipActive = activeCount(KEYS[4])

if clientDaily >= tonumber(ARGV[1]) then return 'ANONYMOUS_DAILY' end
if clientActive >= tonumber(ARGV[2]) then return 'ANONYMOUS_ACTIVE' end
if ipDaily >= tonumber(ARGV[3]) then return 'IP_DAILY' end
if ipActive >= tonumber(ARGV[4]) then return 'IP_ACTIVE' end

redis.call('INCR', KEYS[1])
redis.call('EXPIRE', KEYS[1], tonumber(ARGV[6]))
redis.call('SADD', KEYS[2], ARGV[5])
redis.call('EXPIRE', KEYS[2], tonumber(ARGV[7]))
redis.call('INCR', KEYS[3])
redis.call('EXPIRE', KEYS[3], tonumber(ARGV[6]))
redis.call('SADD', KEYS[4], ARGV[5])
redis.call('EXPIRE', KEYS[4], tonumber(ARGV[7]))
redis.call('SET', KEYS[5], ARGV[8])
redis.call('EXPIRE', KEYS[5], tonumber(ARGV[7]))
return 'OK'
`;

/**
 * Atomically check every dimension and, if all pass, consume one execution,
 * register the run in the active sets, and record its quota scope for release.
 *
 * Rejects with a QuotaReasonCode when any check fails (nothing is mutated).
 */
export async function reserveRun(
  identity: QuotaIdentity,
  runId: string
): Promise<QuotaDecision> {
  if (!QUOTA_ENABLED) {
    return { ok: true, snapshot: await getQuotaSnapshot(identity) };
  }

  const snapshot = await getQuotaSnapshot(identity);
  const { anonymousId, ip } = identity;

  if (!anonymousId) {
    return { ok: false, reason: "MISSING_IDENTITY", snapshot };
  }

  const hasIp = Boolean(ip);
  const dailyTtl = secondsUntilUtcMidnight();
  const activeTtl = RUN_ACTIVE_TTL_SECONDS;

  const result = (await redis.eval(
    RESERVE_LUA,
    5,
    clientDailyKey(anonymousId),
    clientActiveKey(anonymousId),
    ipDailyKey(hasIp ? ip! : ""),
    ipActiveKey(hasIp ? ip! : ""),
    runScopeKey(runId),
    String(ANONYMOUS_DAILY_LIMIT),
    String(ANONYMOUS_ACTIVE_LIMIT),
    String(hasIp ? IP_DAILY_LIMIT : UNBOUNDED),
    String(hasIp ? IP_ACTIVE_LIMIT : UNBOUNDED),
    runId,
    String(dailyTtl),
    String(activeTtl),
    `${anonymousId}~${hasIp ? ipHash(ip!) : ""}`
  )) as string;

  if (result !== "OK") {
    return { ok: false, reason: result as QuotaReasonCode, snapshot: await getQuotaSnapshot(identity) };
  }

  return { ok: true, snapshot: await getQuotaSnapshot(identity) };
}

/**
 * Release a run's concurrency tokens. Called by the job processor when a run
 * ends (or when dispatch failed after reservation). Reading the run's stored
 * scope lets the release target the exact sets that held the token.
 *
 * TTLs make leaked tokens self-clean after SENTINEL_RUN_MAX_SECONDS, so a
 * crashed worker can never permanently lock a visitor out.
 */
export async function releaseRun(runId: string): Promise<void> {
  try {
    const scope = await redis.get(runScopeKey(runId));
    if (!scope) return;

    const separator = scope.indexOf("~");
    const anonymousId = scope.slice(0, separator);
    const ip = scope.slice(separator + 1);

    if (anonymousId) await redis.srem(clientActiveKey(anonymousId), runId);
    if (ip) await redis.srem(ipActiveKey(ip), runId);
    await redis.del(runScopeKey(runId));
  } catch (err) {
    // Non-fatal: active tokens self-expire via their TTL.
    console.error("[quota] releaseRun failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Read-only snapshot (for the UI's "runs remaining" display)
// ---------------------------------------------------------------------------

const range = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

export async function getQuotaSnapshot(identity: QuotaIdentity): Promise<QuotaSnapshot> {
  const { anonymousId, ip } = identity;
  const hasIp = Boolean(ip);

  const [clientDaily, clientActive, ipDaily, ipActive] = await Promise.all([
    anonymousId ? redis.get(clientDailyKey(anonymousId)) : null,
    anonymousId ? redis.scard(clientActiveKey(anonymousId)) : null,
    hasIp ? redis.get(ipDailyKey(ip!)) : null,
    hasIp ? redis.scard(ipActiveKey(ip!)) : null,
  ]);

  const dailyUsed = anonymousId ? range(clientDaily, 0) : 0;
  const active = anonymousId ? range(clientActive, 0) : 0;

  return {
    enabled: QUOTA_ENABLED,
    identity: "anonymous",
    dailyUsed,
    dailyLimit: ANONYMOUS_DAILY_LIMIT,
    active,
    activeLimit: ANONYMOUS_ACTIVE_LIMIT,
    resetsAt: QUOTA_ENABLED ? nextUtcMidnight() : null,
    canRun: !QUOTA_ENABLED || dailyUsed < ANONYMOUS_DAILY_LIMIT && active < ANONYMOUS_ACTIVE_LIMIT,
  };
}

// ---------------------------------------------------------------------------
// Human-readable copy for denial responses (mirrors context/rate-limiting-plan.md)
// ---------------------------------------------------------------------------

export function quotaDenialMessage(reason?: QuotaReasonCode): string {
  switch (reason) {
    case "ANONYMOUS_DAILY":
    case "ANONYMOUS_ACTIVE":
      return "Your trial execution has been used. Create an account to receive 5 executions per day.";
    case "IP_DAILY":
    case "IP_ACTIVE":
      return "Sentinel has reached its execution allowance for this network. Please try again later.";
    case "CAPACITY":
      return "Sentinel is at its current execution capacity. Please try again shortly.";
    case "MISSING_IDENTITY":
      return "Unable to identify your browser. Please enable cookies and reload.";
    default:
      return "Execution limit reached. Please try again later.";
  }
}