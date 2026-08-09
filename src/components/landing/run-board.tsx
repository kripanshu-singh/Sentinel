"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Radar,
  Search,
  Store,
  ShieldCheck,
  AlertTriangle,
  ArrowUpRight,
  RotateCcw,
  FileDown,
  Activity,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Scenario = "variance" | "clean";

interface EventRow {
  step: string;
  label: string;
  detail: string;
  kind: "run" | "ok" | "warn" | "gate";
}

const PROGRAMS: Record<Scenario, { title: string; goal: string; vendor: string; sku: string; events: EventRow[] }> = {
  variance: {
    title: "Bulk Oat Milk · 50x",
    goal: "Build cart with 50x Organic Oat Milk. Target unit price: $3.80. Apply code SP5001.",
    vendor: "target-b2b",
    sku: "SKU-9841",
    events: [
      { step: "PARSE", label: "Goal resolved to plan", detail: "3 steps, 1 coupon gate", kind: "run" },
      { step: "NAVIGATE", label: "Opened target-b2b portal", detail: "Playwright session · HTTP/1.1", kind: "run" },
      { step: "SEARCH", label: "SKU-9841 Oat Milk 50x", detail: "resolved catalog page", kind: "run" },
      { step: "EXTRACT", label: "Unit price found", detail: "$4.35 / unit", kind: "run" },
      { step: "COUPON", label: "Code SP5001 rejected", detail: "portal: 'promo expired'", kind: "warn" },
      { step: "CHECK", label: "Variance +14.4%", detail: "$4.35 vs $3.80 target · > 10%", kind: "gate" },
    ],
  },
  clean: {
    title: "Dell 34\" Monitor · 10x",
    goal: "Procure 10x Dell UltraSharp 34. Target unit price: $320. Apply code PROMO50.",
    vendor: "saucedemo",
    sku: "DELL-34",
    events: [
      { step: "PARSE", label: "Goal resolved to plan", detail: "2 steps, 1 coupon gate", kind: "run" },
      { step: "NAVIGATE", label: "Opened saucedemo portal", detail: "Playwright session · HTTP/1.1", kind: "run" },
      { step: "SEARCH", label: "DELL-34 UltraSharp", detail: "resolved catalog page", kind: "run" },
      { step: "EXTRACT", label: "Unit price found", detail: "$310.00 / unit", kind: "run" },
      { step: "COUPON", label: "PROMO50 applied", detail: "-15% wholesale tier", kind: "ok" },
      { step: "CHECK", label: "Within tolerance", detail: "-3.1% drift · auto-clear", kind: "ok" },
    ],
  },
};

export function RunBoard() {
  const [scenario, setScenario] = useState<Scenario>("variance");
  const [tick, setTick] = useState(0);
  const [resolved, setResolved] = useState<null | "approved" | "aborted">(null);

  const program = PROGRAMS[scenario];
  const isGated = scenario === "variance";
  const asked = isGated && tick >= program.events.length;

  const handleScenario = (s: Scenario) => {
    setScenario(s);
    setTick(0);
    setResolved(null);
  };

  useEffect(() => {
    if (resolved) return;
    if (asked) return;
    const settled = !isGated && tick >= program.events.length + 1;
    if (settled) return;
    const t = setTimeout(() => setTick((n) => n + 1), 820);
    return () => clearTimeout(t);
  }, [tick, resolved, asked, isGated, program.events.length]);

  const shown = program.events.slice(0, Math.min(tick, program.events.length));

  return (
    <div className="relative w-full max-w-5xl mx-auto">
      <div className="rounded-2xl border border-border/80 bg-card/70 backdrop-blur-xl shadow-2xl shadow-border/60 overflow-hidden">
        {/* Console chrome */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-border/70 bg-muted/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-destructive/70" />
              <span className="size-2.5 rounded-full bg-warning/70" />
              <span className="size-2.5 rounded-full bg-positive/70" />
            </div>
            <span className="font-mono text-xs text-muted-foreground truncate hidden sm:inline">
              sentinel // ops-console · clearance-board
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="size-2 rounded-full bg-positive animate-pulse" />
            <span className="font-mono text-[10px] sm:text-xs text-foreground uppercase tracking-wider">
              Guardrails armed
            </span>
          </div>
        </div>

        {/* Body: goal + event rail */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* Incoming goal / switches */}
          <div className="lg:col-span-5 border-b lg:border-b-0 lg:border-r border-border/70 bg-muted/20 p-4 sm:p-5 flex flex-col">
            <div className="mb-4 flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Radar className="size-3.5 text-primary" />
                Inbound goal
              </span>
              <div className="flex gap-1 p-0.5 rounded-lg border border-border/60 bg-background/70">
                {(Object.keys(PROGRAMS) as Scenario[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => handleScenario(s)}
                    className={cn(
                      "px-2.5 py-1 rounded-md font-mono text-[11px] uppercase transition-colors",
                      scenario === s
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {s === "variance" ? "50x oat milk" : "10x dell 34"}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background/80 p-3.5 font-mono text-xs leading-relaxed text-foreground shadow-inner">
              <span className="text-primary font-semibold mr-1.5">{"goal > "}</span>
              {program.goal}
            </div>

            <div className="mt-auto pt-4 border-t border-border/60 mt-4">
              <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                <div className="rounded-lg border border-border/60 px-3 py-2">
                  <div className="text-muted-foreground uppercase tracking-widest">Vendor</div>
                  <div className="text-foreground mt-0.5">{program.vendor}</div>
                </div>
                <div className="rounded-lg border border-border/60 px-3 py-2">
                  <div className="text-muted-foreground uppercase tracking-widest">Product</div>
                  <div className="text-foreground mt-0.5">{program.sku}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Event rail + clearance */}
          <div className="lg:col-span-7 p-4 sm:p-5 flex flex-col relative overflow-hidden">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Activity className="size-3.5 text-primary" />
                Execution stream
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {isGated ? (asked ? "pending clearance" : resolved ? "dispatched" : "in flight") : "auto-cleared"}
              </span>
            </div>

            <div className="space-y-2">
              <AnimatePresence initial={false}>
                {shown.map((ev) => (
                  <motion.div
                    key={`${scenario}-${ev.step}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className={cn(
                      "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                      ev.kind === "warn" || (ev.kind === "gate" && !resolved)
                        ? "border-warning/40 bg-warning/10"
                        : ev.kind === "ok" || (ev.kind === "gate" && resolved === "approved")
                        ? "border-positive/30 bg-positive/5"
                        : "border-border/70 bg-background/50"
                    )}
                  >
                    <span
                      className={cn(
                        "w-16 shrink-0 font-mono text-[10px] font-semibold tracking-widest",
                        ev.kind === "warn" || (ev.kind === "gate" && !resolved)
                          ? "text-warning"
                          : ev.kind === "ok" || (ev.kind === "gate" && resolved === "approved")
                          ? "text-positive"
                          : "text-primary"
                      )}
                    >
                      {ev.step}
                    </span>
                    <span className="shrink-0 size-4 rounded-full border border-border/70 flex items-center justify-center">
                      {ev.kind === "run" ? (
                        <Search className="size-2.5 text-muted-foreground" />
                      ) : ev.kind === "warn" ? (
                        <AlertTriangle className="size-2.5 text-warning" />
                      ) : (
                        <CheckCircle2 className="size-2.5 text-positive" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-foreground truncate">{ev.label}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{ev.detail}</div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Clearance gate */}
              {isGated && asked && !resolved && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-3 rounded-xl border border-warning/50 bg-warning/10 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 size-9 shrink-0 rounded-lg bg-warning/20 flex items-center justify-center">
                      <ShieldCheck className="size-5 text-warning" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">Human clearance required</span>
                        <span className="rounded-full border border-warning/40 px-2 py-0.5 font-mono text-[10px] uppercase text-warning">
                          HITL intercept
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-[11px]">
                        <div className="rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5">
                          <span className="text-muted-foreground block">Contract</span>
                          <span className="text-foreground">$3.80</span>
                        </div>
                        <div className="rounded-md border border-warning/40 px-2.5 py-1.5">
                          <span className="text-warning block">Found</span>
                          <span className="text-warning">$4.35</span>
                        </div>
                        <div className="rounded-md border border-border/60 bg-background/70 px-2.5 py-1.5">
                          <span className="text-muted-foreground block">Drift</span>
                          <span className="text-destructive">+14.19%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => setResolved("approved")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Approve &amp; dispatch
                    </button>
                    <button
                      onClick={() => setResolved("aborted")}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <RotateCcw className="size-3.5" />
                      Abort run
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Aftermath */}
              <AnimatePresence>
                {resolved && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="rounded-xl border border-positive/40 bg-positive/10 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="size-9 shrink-0 rounded-lg bg-positive/20 flex items-center justify-center">
                        {resolved === "approved" ? (
                          <FileDown className="size-5 text-positive" />
                        ) : (
                          <RotateCcw className="size-5 text-destructive" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground">
                          {resolved === "approved"
                            ? "Run dispatched — draft invoice ready"
                            : "Run aborted before draft"}
                        </div>
                        <div className="font-mono text-[11px] text-muted-foreground truncate">
                          {resolved === "approved"
                            ? "reconciliation-report.csv · 50 lines verified"
                            : "no funds committed · agent parked at edge"}
                        </div>
                      </div>
                      {resolved === "approved" && (
                        <ArrowUpRight className="size-4 text-positive shrink-0" />
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Pending indicator */}
              {!asked && !resolved && (
                <div className="flex items-center gap-2 pt-1 font-mono text-[11px] text-muted-foreground">
                  <span className="h-3.5 w-px bg-foreground/25 animate-pulse" />
                  <span className="flex items-center gap-1.5">
                    <span className="flex items-center gap-0.5">
                      <span className="size-1 rounded-full bg-muted-foreground animate-pulse" />
                      <span className="size-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:120ms]" />
                      <span className="size-1 rounded-full bg-muted-foreground animate-pulse [animation-delay:240ms]" />
                    </span>
                    agent executing...
                  </span>
                </div>
              )}
            </div>

            {/* Furnace copy at bottom of console */}
            <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Store className="size-3 text-primary" />
                {program.vendor}
              </span>
              <span>SSE · live</span>
            </div>
          </div>
        </div>
      </div>

      {/* sloped base shadow */}
      <div className="pointer-events-none absolute inset-x-8 -bottom-5 h-10 rounded-[100%] bg-primary/10 blur-2xl" aria-hidden />
    </div>
  );
}