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
async function startServer() {
  console.log("[server] Starting Sentinel worker bootstrap...");
  
  try {
    // 1. Ensure Postgres tables are created in development
    await createTablesIfNotExist();
    console.log("[db] Schema check complete");

    // 2. Start BullMQ queue processor
    startQueueWorker();
    console.log("[queue] Background task worker listening for runs");

    // 3. Start Express server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[server] Worker is listening at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error("[server] Bootstrap crash:", err);
    process.exit(1);
  }
}

startServer();
