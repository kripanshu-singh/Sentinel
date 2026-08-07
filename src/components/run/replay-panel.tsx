"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { AgentEvent } from "@/types";

type ReplayPanelProps = {
  runId: string | null;
  events: AgentEvent[];
};

type Comment = { id: string; text: string; at: number };

function storageKey(runId: string) {
  return `replay-comments:${runId}`;
}

export default function ReplayPanel({ runId, events }: ReplayPanelProps) {
  const moments = useMemo(() => {
    return events.map((e) => ({ id: e.id, title: e.title, timestamp: e.timestamp, screenshot: typeof e.evidence?.screenshot === "string" ? e.evidence.screenshot : undefined }));
  }, [events]);

  const [index, setIndex] = useState<number>(() => Math.max(0, events.length - 1));
  const selected = moments[Math.min(index, Math.max(0, moments.length - 1))];

  // comments stored per-run in localStorage, keyed by event id
  const [commentsMap, setCommentsMap] = useState<Record<string, Comment[]>>(() => {
    if (!runId) return {};
    try {
      const raw = localStorage.getItem(storageKey(runId));
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { index?: number } | undefined;
      const idx = detail?.index;
      if (typeof idx === "number" && idx >= 0 && idx < moments.length) setIndex(idx);
    };
    window.addEventListener("sentinel:replay-jump-local", handler as EventListener);
    return () => window.removeEventListener("sentinel:replay-jump-local", handler as EventListener);
  }, [moments.length]);

  function saveComments(newMap: Record<string, Comment[]>) {
    setCommentsMap(newMap);
    if (!runId) return;
    try {
      localStorage.setItem(storageKey(runId), JSON.stringify(newMap));
    } catch {
      // ignore
    }
  }

  function addComment(eventId: string, text: string) {
    if (!text.trim()) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const next = { ...(commentsMap || {}) };
    next[eventId] = [...(next[eventId] ?? []), { id, text: text.trim(), at: Date.now() }];
    saveComments(next);
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Time Machine</h4>

      <div className="flex gap-2 items-center mb-3 overflow-x-auto py-1">
        {moments.map((m, i) => (
          <button
            key={m.id}
            onClick={() => setIndex(i)}
            className={cn(
              "px-2 py-1 text-xs rounded-lg border",
              i === index ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border text-muted-foreground",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="border border-border rounded-lg p-3 mb-3 bg-background">
        {selected ? (
          <div className="flex flex-col gap-2">
            <div className="relative h-36 w-full bg-black/5 rounded overflow-hidden">
              {selected.screenshot ? (
                <Image src={selected.screenshot} alt={selected.title} fill unoptimized className="object-contain" />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-muted-foreground">No capture</div>
              )}
            </div>
            <div className="text-xs">
              <div className="font-semibold text-foreground">{selected.title}</div>
              <div className="text-[11px] text-muted-foreground">{selected.timestamp}</div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">No moments yet</div>
        )}
      </div>

      {/* Comments */}
      <div className="text-xs">
        <div className="font-semibold mb-2">Comments</div>
        {selected ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 max-h-36 overflow-y-auto">
              {(commentsMap[selected.id] ?? []).map((c) => (
                <div key={c.id} className="text-xs bg-card border border-border rounded p-2">
                  <div className="text-[11px] text-muted-foreground">{new Date(c.at).toLocaleString()}</div>
                  <div className="mt-1 text-foreground">{c.text}</div>
                </div>
              ))}
            </div>
            <CommentInput onSubmit={(text) => addComment(selected.id, text)} />
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Select a moment to view or add comments.</div>
        )}
      </div>
    </div>
  );
}

function CommentInput({ onSubmit }: { onSubmit: (text: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="flex gap-2 items-start">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add a comment" className="flex-1 px-2 py-1 text-xs border border-border rounded bg-transparent focus:ring-1 focus:ring-primary" />
      <button onClick={() => { onSubmit(v); setV(""); }} className="px-3 py-1 rounded bg-primary text-primary-foreground text-xs">Add</button>
    </div>
  );
}
