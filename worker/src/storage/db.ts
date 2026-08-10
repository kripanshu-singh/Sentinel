/**
 * worker/src/storage/db.ts
 *
 * Drizzle ORM schema + client for PostgreSQL.
 * Tables: runs, agent_events, approval_requests, reconciliation_reports
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  pgTable,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required");
}

// ---------------------------------------------------------------------------
// Postgres client
// ---------------------------------------------------------------------------

const client = postgres(DATABASE_URL, { max: 10 });
export const db = drizzle(client);

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const runStatusEnum = pgEnum("run_status", [
  "PENDING",
  "PARSED",
  "NAVIGATING",
  "EXTRACTING",
  "CHECKING",
  "HITL_PENDING",
  "RESUME",
  "FORM_FILLING",
  "VALIDATING",
  "RECOVERING",
  "DRAFT_READY",
  "DONE",
  "ABORTED",
  "FAILED",
]);

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

export const runs = pgTable("runs", {
  runId: text("run_id").primaryKey(),
  goal: text("goal").notNull(),
  status: runStatusEnum("status").notNull().default("PENDING"),
  targetUnitPrice: real("target_unit_price"),
  targetSubtotal: real("target_subtotal"),
  varianceThresholdPct: real("variance_threshold_pct").notNull().default(10),
  discountCode: text("discount_code"),
  fallbackPolicy: text("fallback_policy").notNull().default("default_wholesale"),
  anonymousId: text("anonymous_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentEvents = pgTable("agent_events", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.runId, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  status: text("status"),
  evidence: jsonb("evidence"),
  timestamp: text("timestamp").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const approvalRequests = pgTable("approval_requests", {
  id: text("id").primaryKey(),
  runId: text("run_id")
    .notNull()
    .references(() => runs.runId, { onDelete: "cascade" }),
  title: text("title").notNull(),
  detail: text("detail").notNull(),
  discrepancies: jsonb("discrepancies").notNull().$type<object[]>(),
  resolution: jsonb("resolution").$type<object>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const reconciliationReports = pgTable("reconciliation_reports", {
  runId: text("run_id")
    .primaryKey()
    .references(() => runs.runId, { onDelete: "cascade" }),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  items: jsonb("items").notNull().$type<object[]>(),
  discrepancies: jsonb("discrepancies").notNull().$type<object[]>(),
  channels: jsonb("channels").$type<object[]>(),
  comparison: jsonb("comparison").$type<object[]>(),
  summary: text("summary").notNull(),
});

// ---------------------------------------------------------------------------
// Schema type exports (inferred from table definitions)
// ---------------------------------------------------------------------------

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type AgentEventRow = typeof agentEvents.$inferSelect;
export type ApprovalRequestRow = typeof approvalRequests.$inferSelect;
export type ReconciliationReportRow = typeof reconciliationReports.$inferSelect;

// ---------------------------------------------------------------------------
// Schema object (for drizzle-kit migrations)
// ---------------------------------------------------------------------------

export const schema = {
  runs,
  agentEvents,
  approvalRequests,
  reconciliationReports,
};

// ---------------------------------------------------------------------------
// Migration helpers (run once on startup in dev)
// ---------------------------------------------------------------------------

/**
 * Create all tables if they don't exist.
 * In production, use `drizzle-kit push` or a proper migration instead.
 */
export async function createTablesIfNotExist(): Promise<void> {
  await client`
    DO $$
    BEGIN
      CREATE TYPE run_status AS ENUM (
        'PENDING','PARSED','NAVIGATING','EXTRACTING','CHECKING',
        'HITL_PENDING','RESUME','FORM_FILLING','VALIDATING','RECOVERING',
        'DRAFT_READY','DONE','ABORTED','FAILED'
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END
    $$
  `;

  await client`
    CREATE TABLE IF NOT EXISTS runs (
      run_id                TEXT PRIMARY KEY,
      goal                  TEXT NOT NULL,
      status                run_status NOT NULL DEFAULT 'PENDING',
      target_unit_price     REAL,
      target_subtotal       REAL,
      variance_threshold_pct REAL NOT NULL DEFAULT 10,
      discount_code         TEXT,
      fallback_policy       TEXT NOT NULL DEFAULT 'default_wholesale',
      created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await client`
    ALTER TABLE runs ADD COLUMN IF NOT EXISTS target_subtotal REAL;
  `;

  await client`
    ALTER TABLE runs ADD COLUMN IF NOT EXISTS anonymous_id TEXT;
  `;

  await client`
    CREATE TABLE IF NOT EXISTS agent_events (
      id          TEXT PRIMARY KEY,
      run_id      TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      detail      TEXT NOT NULL,
      status      TEXT,
      evidence    JSONB,
      timestamp   TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS approval_requests (
      id            TEXT PRIMARY KEY,
      run_id        TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
      title         TEXT NOT NULL,
      detail        TEXT NOT NULL,
      discrepancies JSONB NOT NULL,
      resolution    JSONB,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      resolved_at   TIMESTAMPTZ
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS reconciliation_reports (
      run_id        TEXT PRIMARY KEY REFERENCES runs(run_id) ON DELETE CASCADE,
      generated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      items         JSONB NOT NULL,
      discrepancies JSONB NOT NULL,
      channels      JSONB,
      comparison    JSONB,
      summary       TEXT NOT NULL
    )
  `;

  await client`
    ALTER TABLE reconciliation_reports ADD COLUMN IF NOT EXISTS comparison JSONB;
  `;
}

export { integer };
