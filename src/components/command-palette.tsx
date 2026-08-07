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
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      if ((isMac && e.metaKey && e.key.toLowerCase() === "k") || (!isMac && e.ctrlKey && e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

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

  const getActiveRunId = () => {
    if (runIdFromPath) return runIdFromPath;
    try {
      return window.localStorage.getItem("sentinel:last-run-id") ?? null;
    } catch {
      return null;
    }
  };

  const runCommandsEnabled = Boolean(getActiveRunId());

  const commands: Command[] = useMemo(() => {
    const activeRunId = getActiveRunId();
    const isRunPage = Boolean(pathname?.startsWith("/runs/"));

    return [
      {
        id: "home",
        title: "Go to Home",
        subtitle: "Open the goal input screen",
        run: () => router.push("/"),
      },
      {
        id: "start-tour",
        title: "Start Tour",
        subtitle: "Open the quick onboarding tour",
        run: () => dispatch("sentinel:start-tour"),
      },
      {
        id: "focus-steer",
        title: "Focus Steer Input",
        subtitle: isRunPage
          ? "Focus the live-run steer box on this page"
          : activeRunId
            ? "Open the active run and focus the steer box"
            : "No active run available",
        run: () => {
          if (!activeRunId) return;
          if (isRunPage) {
            dispatch("sentinel:focus-steer");
            return;
          }
          router.push(`/runs/${encodeURIComponent(activeRunId)}`);
          window.setTimeout(() => dispatch("sentinel:focus-steer"), 250);
        },
        disabled: !activeRunId,
      },
      {
        id: "open-result",
        title: "Open Result Report",
        subtitle: activeRunId
          ? "Open the result report for the active run"
          : "No active run available",
        run: () => {
          if (!activeRunId) return;
          router.push(`/runs/${encodeURIComponent(activeRunId)}/result`);
        },
        disabled: !activeRunId,
      },
      {
        id: "export-csv",
        title: "Export CSV",
        subtitle: activeRunId
          ? "Export the current run report as CSV"
          : "No active run available",
        run: () => {
          if (!activeRunId) return;
          router.push(`/runs/${encodeURIComponent(activeRunId)}/result`);
          window.setTimeout(() => dispatch("sentinel:export-csv"), 250);
        },
        disabled: !activeRunId,
      },
    ];
  }, [pathname, router, runCommandsEnabled]);

  const filtered = commands.filter((c) =>
    `${c.title} ${c.subtitle ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div aria-hidden={!open} className={cn(open ? "" : "pointer-events-none")}>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-28 px-4">
          <div className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-2xl">
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
              {filtered.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => { if (!cmd.disabled) { cmd.run(); setOpen(false); } }}
                  disabled={cmd.disabled}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md flex flex-col",
                    cmd.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/40",
                  )}
                >
                  <span className="text-sm font-medium text-foreground">{cmd.title}</span>
                  {cmd.subtitle && (
                    <span className="text-xs text-muted-foreground">{cmd.subtitle}</span>
                  )}
                </button>
              ))}
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
