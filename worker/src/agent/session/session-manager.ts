/**
 * worker/src/agent/session/session-manager.ts
 *
 * Owns the Playwright browser lifecycle for the whole worker.
 *
 * The graph never serializes Page/Browser/Context — nodes ask the SessionManager
 * for a session and state stores only a `sessionId`. Browser sessions are created
 * lazily (only when the first action needs them) and closed when a run finishes.
 */

import { Navigator } from "../navigator.js";
import type { Page } from "playwright";

export interface BrowserSession {
  runId: string;
  navigator: Navigator;
  page: Page;
}

class SessionManager {
  private sessions = new Map<string, BrowserSession>();

  /**
   * Get (or lazily create) the browser session for a run.
   * One Playwright context + page per run.
   */
  async get(runId: string): Promise<BrowserSession> {
    const existing = this.sessions.get(runId);
    if (existing) return existing;

    const navigator = new Navigator();
    const page = await navigator.initialize();
    const session: BrowserSession = { runId, navigator, page };
    this.sessions.set(runId, session);
    return session;
  }

  /** Close and release a run's browser session. Safe to call more than once. */
  async close(runId: string): Promise<void> {
    const session = this.sessions.get(runId);
    if (!session) return;
    this.sessions.delete(runId);
    try {
      await session.navigator.close();
    } catch (err: unknown) {
      console.warn(`[session:${runId}] Error closing browser:`, err);
    }
  }

  /** Close all sessions (shutdown path). */
  async closeAll(): Promise<void> {
    const runIds = [...this.sessions.keys()];
    await Promise.all(runIds.map((id) => this.close(id)));
  }
}

/** Singleton shared by every graph node. */
export const sessionManager = new SessionManager();
