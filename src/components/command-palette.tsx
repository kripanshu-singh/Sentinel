"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface Command {
  id: string;
  title: string;
  subtitle?: string;
  run: () => void;
  disabled?: boolean;
}

export default function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const handleOpen = () => setOpen(true);
    window.addEventListener("sentinel:open-command-palette", handleOpen);
    return () => window.removeEventListener("sentinel:open-command-palette", handleOpen);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  const [prevQuery, setPrevQuery] = useState(query);
  const [prevOpen, setPrevOpen] = useState(open);

  if (query !== prevQuery || open !== prevOpen) {
    setPrevQuery(query);
    setPrevOpen(open);
    setSelectedIndex(0);
  }

  const dispatch = (name: string, detail?: unknown) => {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  };

  const runIdFromPath = useMemo(() => {
    const segments = (pathname ?? "").split("/").filter(Boolean);
    if (segments[0] === "runs" && segments[1]) return segments[1];
    return null;
  }, [pathname]);

  useEffect(() => {
    if (!runIdFromPath) return;
    try {
      window.localStorage.setItem("sentinel:last-run-id", runIdFromPath);
    } catch {
      // ignore storage errors
    }
  }, [runIdFromPath]);

  const commands: Command[] = useMemo(() => {
    // Reference open to ensure list re-evaluates when palette is opened (e.g. reading DOM values)
    if (open) { /* no-op */ }
    const activeRunId = runIdFromPath || (() => {
      try {
        return typeof window !== "undefined" ? window.localStorage.getItem("sentinel:last-run-id") ?? null : null;
      } catch {
        return null;
      }
    })();
    const isHome = pathname === "/app" || pathname === "/";
    const isResultPage = pathname ? /^\/runs\/[^/]+\/result$/.test(pathname) : false;
    const isLiveRunPage = pathname ? /^\/runs\/[^/]+$/.test(pathname) : false;
    const runIdFromUrl = runIdFromPath;

    // Read the goal textarea dynamically from DOM to enable/disable Start Run
    let hasGoalText = false;
    if (typeof document !== "undefined") {
      const goalEl = document.getElementById("goal") as HTMLTextAreaElement | null;
      if (goalEl && goalEl.value.trim().length > 0) {
        hasGoalText = true;
      }
    }

    const list: Command[] = [];

    if (isHome) {
      // 1. Focus Goal Input
      list.push({
        id: "focus-goal",
        title: "Focus Goal Input",
        subtitle: "Focus the procurement goal input textarea",
        run: () => {
          const el = document.getElementById("goal");
          if (el) el.focus();
        },
      });

      // 2. Start Run
      list.push({
        id: "start-run",
        title: "Start Run",
        subtitle: hasGoalText
          ? "Submit the procurement goal and start the agent"
          : "Write a goal first to start run",
        run: () => {
          const btn = document.getElementById("tour-start");
          if (btn) btn.click();
        },
        disabled: !hasGoalText,
      });

      // 3. Go to Live Run
      list.push({
        id: "focus-steer",
        title: "Go to Live Run",
        subtitle: activeRunId
          ? `Open active run (${activeRunId.slice(0, 8)}...)`
          : "No active run available",
        run: () => {
          if (activeRunId) {
            router.push(`/runs/${encodeURIComponent(activeRunId)}`);
            window.setTimeout(() => dispatch("sentinel:focus-steer"), 250);
          }
        },
        disabled: !activeRunId,
      });

      // 4. Open Result Report
      list.push({
        id: "open-result",
        title: "Open Result Report",
        subtitle: activeRunId
          ? `Open result report for active run (${activeRunId.slice(0, 8)}...)`
          : "No active run — start a run first",
        run: () => {
          if (activeRunId) {
            router.push(`/runs/${encodeURIComponent(activeRunId)}/result`);
          } else {
            const el = document.getElementById("goal");
            if (el) el.focus();
          }
        },
      });

      // 5. Export CSV
      list.push({
        id: "export-csv",
        title: "Export CSV",
        subtitle: activeRunId
          ? `Export report data for active run (${activeRunId.slice(0, 8)}...)`
          : "No active run — start a run first",
        run: () => {
          if (activeRunId) {
            router.push(`/runs/${encodeURIComponent(activeRunId)}/result`);
            window.setTimeout(() => dispatch("sentinel:export-csv"), 250);
          } else {
            const el = document.getElementById("goal");
            if (el) el.focus();
          }
        },
      });
    } else if (isLiveRunPage && runIdFromUrl) {
      // 1. Focus Operator Input
      list.push({
        id: "focus-steer",
        title: "Focus Operator Input",
        subtitle: "Focus the input field to send a redirect instruction to the agent",
        run: () => {
          dispatch("sentinel:focus-steer");
        },
      });

      // 2. Open Result Report
      list.push({
        id: "open-result",
        title: "Open Result Report",
        subtitle: "Open the result report for this run",
        run: () => {
          router.push(`/runs/${encodeURIComponent(runIdFromUrl)}/result`);
        },
      });

      // 3. Export CSV
      list.push({
        id: "export-csv",
        title: "Export CSV",
        subtitle: "Navigate to result page and export report as CSV",
        run: () => {
          router.push(`/runs/${encodeURIComponent(runIdFromUrl)}/result`);
          window.setTimeout(() => dispatch("sentinel:export-csv"), 250);
        },
      });

      // 4. Go to Home
      list.push({
        id: "home",
        title: "Go to Home / New Run",
        subtitle: "Open the goal input screen to start a new task",
        run: () => router.push("/app"),
      });
    } else if (isResultPage && runIdFromUrl) {
      // 1. Export CSV
      list.push({
        id: "export-csv",
        title: "Export CSV",
        subtitle: "Export the reconciliation report as CSV immediately",
        run: () => {
          dispatch("sentinel:export-csv");
        },
      });

      // 2. Go to Live Run
      list.push({
        id: "go-to-live",
        title: "Go to Live Run",
        subtitle: "Navigate back to the live event timeline for this run",
        run: () => {
          router.push(`/runs/${encodeURIComponent(runIdFromUrl)}`);
        },
      });

      // 3. Go to Home
      list.push({
        id: "home",
        title: "Go to Home / New Run",
        subtitle: "Open the goal input screen to start a new task",
        run: () => router.push("/app"),
      });
    } else {
      // Fallback
      list.push({
        id: "home",
        title: "Go to Home / New Run",
        subtitle: "Open the goal input screen",
        run: () => router.push("/app"),
      });
      if (activeRunId) {
        list.push({
          id: "open-result",
          title: "Open Result Report",
          subtitle: `Open report for active run (${activeRunId.slice(0, 8)}...)`,
          run: () => router.push(`/runs/${encodeURIComponent(activeRunId)}/result`),
        });
      }
    }

    // Always include tour
    list.push({
      id: "start-tour",
      title: "Start Tour",
      subtitle: "Open the quick onboarding tour",
      run: () => dispatch("sentinel:start-tour"),
    });

    return list;
  }, [pathname, router, open, runIdFromPath]);

  const filtered = useMemo(() => {
    return commands.filter((c) =>
      `${c.title} ${c.subtitle ?? ""}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [commands, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      if ((isMac && e.metaKey && e.key.toLowerCase() === "k") || (!isMac && e.ctrlKey && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }

      if (open && filtered.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filtered.length);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
        } else if (e.key === "Enter") {
          e.preventDefault();
          const selected = filtered[selectedIndex];
          if (selected && !selected.disabled) {
            selected.run();
            setOpen(false);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, selectedIndex]);

  return (
    <div aria-hidden={!open} className={cn(open ? "" : "pointer-events-none")}>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-28 px-4">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-2xl rounded-lg border border-border bg-card shadow-2xl z-10 flex flex-col">
            <div className="px-4 py-3">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command or search... (Cmd/Ctrl+K to open)"
                className="w-full bg-background px-3 py-2 rounded-md border border-input focus:outline-none focus:border-primary text-sm"
                aria-label="Command palette"
              />
            </div>
            <div className="max-h-72 overflow-auto px-2 pb-2">
              {filtered.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">No commands</div>
              )}
              {filtered.map((cmd, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      if (!cmd.disabled) {
                        cmd.run();
                        setOpen(false);
                      }
                    }}
                    disabled={cmd.disabled}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md flex flex-col transition-colors border border-transparent outline-none",
                      cmd.disabled
                        ? "opacity-50 cursor-not-allowed"
                        : isSelected
                          ? "bg-accent text-accent-foreground border-accent-foreground/20"
                          : "hover:bg-accent/40"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium text-foreground",
                      isSelected && "text-accent-foreground"
                    )}>
                      {cmd.title}
                    </span>
                    {cmd.subtitle && (
                      <span className={cn(
                        "text-xs text-muted-foreground",
                        isSelected && "text-accent-foreground/70"
                      )}>
                        {cmd.subtitle}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-2 border-t border-border flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
