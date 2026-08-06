"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { AgentEvent } from "@/types";

const MAX_BACKOFF_MS = 30_000;

export function useRunStream(runId: string) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the last received event id so we can pass Last-Event-ID on reconnect.
  const lastEventIdRef = useRef<string | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const abortedRef = useRef(false);
  const connectRef = useRef<() => void>(() => undefined);

  const connect = useCallback(() => {
    if (abortedRef.current) return;

    const url = new URL(`/api/runs/${encodeURIComponent(runId)}/stream`, window.location.href);
    if (lastEventIdRef.current) {
      url.searchParams.set("lastEventId", lastEventIdRef.current);
    }

    const es = new EventSource(url.toString());
    esRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
      retryCountRef.current = 0;
    };

    es.onmessage = (e) => {
      // SSE spec: the browser tracks lastEventId automatically but we mirror it
      // for the query param fallback used when EventSource doesn't send the header.
      try {
        const evt = JSON.parse(e.data as string) as AgentEvent;
        lastEventIdRef.current = evt.id;
        setEvents((prev) => {
          // Deduplicate: skip if we already have this event id
          if (prev.some((p) => p.id === evt.id)) return prev;
          return [...prev, evt];
        });
      } catch {
        /* ignore malformed events */
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      setIsConnected(false);

      if (abortedRef.current) return;

      // Exponential backoff: 1s, 2s, 4s, … capped at MAX_BACKOFF_MS
      const delay = Math.min(1_000 * 2 ** retryCountRef.current, MAX_BACKOFF_MS);
      retryCountRef.current += 1;
      setError(`Connection lost — reconnecting in ${Math.round(delay / 1000)}s…`);

      retryTimerRef.current = setTimeout(() => {
        setError(null);
        connectRef.current();
      }, delay);
    };
  }, [runId]);

  useEffect(() => {
    connectRef.current = connect;
    abortedRef.current = false;
    connect();

    return () => {
      abortedRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      esRef.current?.close();
    };
  }, [connect]);

  return { events, isConnected, error };
}
