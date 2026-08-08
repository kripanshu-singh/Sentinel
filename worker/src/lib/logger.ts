import { emitEvent } from "../agent/graph/emit.js";

export function formatValue(value: unknown, maxLength = 240): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return truncate(value, maxLength);
  try {
    return truncate(JSON.stringify(value), maxLength);
  } catch {
    return String(value);
  }
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

export function log(scope: string, message: string, data?: unknown): void {
  const ts = new Date().toISOString();
  const suffix = data === undefined ? "" : ` ${formatValue(data)}`;
  console.log(`[${ts}] [${scope}] ${message}${suffix}`);
}

/**
 * A run-scoped logger that writes to both the terminal AND the SSE event
 * stream so the operator can see backend diagnostics in the UI timeline
 * without opening the server logs.
 *
 * Usage:
 *   const runLog = new RunLogger(runId);
 *   runLog.warn("navigator", "Page load slow", { url, elapsed });
 *   runLog.error("extractor", "LLM parse failed", err);
 */
export class RunLogger {
  constructor(private readonly runId: string) {}

  private write(
    level: "info" | "warn" | "error",
    scope: string,
    message: string,
    data?: unknown
  ): void {
    const ts = new Date().toISOString();
    const suffix = data === undefined ? "" : ` ${formatValue(data)}`;
    console[level](`[${ts}] [${scope}:${this.runId.slice(0, 8)}] ${message}${suffix}`);

    // Surface warn/error to the SSE stream as a RECOVER diagnostic event.
    // Fire-and-forget — never let logging failures abort the run.
    if (level !== "info") {
      const detail = data !== undefined
        ? `${message} — ${formatValue(data, 400)}`
        : message;
      emitEvent(
        this.runId,
        "RECOVER",
        `[${level.toUpperCase()}] ${scope}`,
        detail,
        level === "error" ? "error" : "pending",
        typeof data === "object" && data !== null ? (data as Record<string, unknown>) : undefined
      ).catch(() => undefined);
    }
  }

  info(scope: string, message: string, data?: unknown): void {
    this.write("info", scope, message, data);
  }

  warn(scope: string, message: string, data?: unknown): void {
    this.write("warn", scope, message, data);
  }

  error(scope: string, message: string, data?: unknown): void {
    this.write("error", scope, message, data);
  }
}
