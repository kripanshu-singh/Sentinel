"use client";

import { useEffect, useRef, useState } from "react";
import type { AgentEvent } from "@/types";

const MOCK_EVENTS: AgentEvent[] = [
  {
    id: "1",
    runId: "mock",
    type: "NAVIGATE",
    title: "Initializing procurement run",
    detail: "Connecting to vendor portal VN-821",
    timestamp: "10:42:01",
    status: "success",
  },
  {
    id: "2",
    runId: "mock",
    type: "SEARCH",
    title: "Searching product catalog",
    detail: 'Searching for "Almond Milk Barista Edition 1L"',
    timestamp: "10:42:12",
    status: "success",
  },
  {
    id: "3",
    runId: "mock",
    type: "EXTRACT",
    title: "Analyzing 12 results",
    detail: "Applying SKU-match filter — exact match found: ALM-BAR-1L",
    timestamp: "10:42:15",
    status: "success",
  },
  {
    id: "4",
    runId: "mock",
    type: "CHECK",
    title: "Price validation failed",
    detail: "Found $4.80 — target $4.00 (+20%). Exceeds 5% PANTRY threshold.",
    timestamp: "10:42:22",
    status: "error",
  },
  {
    id: "5",
    runId: "mock",
    type: "HITL",
    title: "Awaiting human approval",
    detail: "Run paused. Variance alert dispatched to operator.",
    timestamp: "10:42:23",
    status: "pending",
  },
];

export function useRunStream(runId: string) {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (runId === "1") {
      const timers: ReturnType<typeof setTimeout>[] = [];
      const connectTimer = setTimeout(() => setIsConnected(true), 0);
      timers.push(connectTimer);
      MOCK_EVENTS.forEach((evt, i) => {
        const t = setTimeout(
          () => setEvents((prev) => [...prev, evt]),
          i * 600
        );
        timers.push(t);
      });
      return () => timers.forEach(clearTimeout);
    }

    const es = new EventSource(`/api/runs/${runId}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as AgentEvent;
        setEvents((prev) => [...prev, evt]);
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      setError("Connection lost — attempting to reconnect…");
      setIsConnected(false);
    };

    return () => {
      es.close();
    };
  }, [runId]);

  return { events, isConnected, error };
}
