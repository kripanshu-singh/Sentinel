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
import steerRouter from "./routes/steer.js";
import { startQueueWorker } from "./queue/jobs.js";
import { createTablesIfNotExist } from "./storage/db.js";

const app = express();
// Render's default health-check probe port for web services is 10000, so fall
// back to that when PORT is not injected (never default to an arbitrary port).
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 10000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/runs", runsRouter);
app.use("/runs", streamRouter); // Mount GET /runs/:id/stream
app.use("/runs", resolveRouter); // Mount POST /runs/:id/resolve
app.use("/runs", steerRouter); // Mount POST /runs/:id/steer (ADR-012)

// Liveness check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Initialization
function startServer() {
  console.log("[server] Starting Sentinel worker bootstrap...");

  // Start Express server on process.env.PORT, 10000, and 3001 so /health answers
  // immediately regardless of Render dashboard configuration or port routing.
  const portsToListen = new Set<number>();
  if (process.env.PORT) {
    portsToListen.add(parseInt(process.env.PORT, 10));
  }
  portsToListen.add(10000);
  portsToListen.add(3001);

  for (const port of portsToListen) {
    const server = app.listen(port, "0.0.0.0", () => {
      console.log(`[server] Worker is listening at http://0.0.0.0:${port}`);
    });
    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.log(`[server] Port ${port} already bound, skipping secondary bind.`);
      } else {
        console.error(`[server] Error listening on port ${port}:`, err);
      }
    });
  }

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
