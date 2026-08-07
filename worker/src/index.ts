/**
 * worker/src/index.ts
 *
 * Worker application entry point.
 * Setup local server endpoints, db schema checks, and start background workers.
 */

import express, { type Request, type Response } from "express";
import cors from "cors";
import runsRouter from "./routes/runs.js";
import streamRouter from "./routes/stream.js";
import resolveRouter from "./routes/resolve.js";
import { startQueueWorker } from "./queue/jobs.js";
import { createTablesIfNotExist } from "./storage/db.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/runs", runsRouter);
app.use("/runs", streamRouter); // Mount GET /runs/:id/stream
app.use("/runs", resolveRouter); // Mount POST /runs/:id/resolve

// Liveness check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Initialization
function startServer() {
  console.log("[server] Starting Sentinel worker bootstrap...");

  // 1. Start Express server FIRST so /health answers immediately. Render's
  // deploy health check must never wait on the DB schema init below.
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[server] Worker is listening at http://localhost:${PORT}`);
  });

  // 2. Boot background services without blocking the HTTP server.
  const boot = async () => {
    // Ensure Postgres tables are created (development; idempotent)
    try {
      await createTablesIfNotExist();
      console.log("[db] Schema check complete");
    } catch (err) {
      console.error("[db] Schema check failed:", err);
    }

    // Start BullMQ queue processor
    try {
      startQueueWorker();
      console.log("[queue] Background task worker listening for runs");
    } catch (err) {
      console.error("[queue] Failed to start background worker:", err);
    }
  };

  boot();
}

startServer();
