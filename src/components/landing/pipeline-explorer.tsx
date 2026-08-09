"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Compass,
  GitBranch,
  Grid3X3,
  ShieldCheck,
  FileSpreadsheet,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Phase {
  id: string;
  num: string;
  title: string;
  short: string;
  desc: string;
  icon: typeof Compass;
  logs: string[];
}

const PHASES: Phase[] = [
  {
    id: "resolve",
    num: "01",
    title: "Resolve",
    short: "Parses the goal into a guarded plan",
    desc: "A plain-English procurement goal becomes a typed execution plan: target price, quantity, coupon gates, and tolerance band — validated before any browser opens.",
    icon: Compass,
    logs: [
      "PARSE: goal -> plan {steps: 4, gates: 2}",
      "RULES: target_unit=3.80, tolerance=10%",
      "GATES: coupon:SP5001 at checkout",
    ],
  },
  {
    id: "navigate",
    num: "02",
    title: "Navigate",
    short: "Drives the storefront like an operator",
    desc: "Sentinel opens the vendor portal in a real browser session, resolves direct product URLs, and reads the live catalog without shortcuts or fabricated checkouts.",
    icon: GitBranch,
    logs: [
      "PLAYWRIGHT: opened target-b2b",
      "NAVIGATE: /catalog/sku-9841",
      "SNAP: dom snapshot, results=1",
    ],
  },
  {
    id: "extract",
    num: "03",
    title: "Extract & compare",
    short: "Reads prices and rules against contract",
    desc: "Live unit prices, discount codes, and shipping are extracted and compared to the contract. Any drift is measured, not assumed.",
    icon: Grid3X3,
    logs: [
      "EXTRACT: unit_price=`$4.35`",
      "COUPON: SP5001 -> expired",
      "COMPARE: drift=+14.19% > band",
    ],
  },
  {
    id: "hitl",
    num: "04",
    title: "HITL intercept",
    short: "Stops cold for a human sign-off",
    desc: "The moment a price variance or rule exception appears, the run pauses. Nothing advances, and no draft is written until a human approves, overrides, or aborts.",
    icon: ShieldCheck,
    logs: [
      "HITL: pause (variance +14.19%)",
      "HOLD: awaiting operator decision",
      "RESOLVE: approve -> resume",
    ],
  },
  {
    id: "dispatch",
    num: "05",
    title: "Dispatch",
    short: "Fills the invoice draft, stops before paying",
    desc: "The invoice and receiving fields are filled, a normalized line-item report is generated, and the run parks at the review screen — never at checkout.",
    icon: FileSpreadsheet,
    logs: [
      "FORM_FILL: qty=50, ship->rev",
      "REPORT: 3 items, 1 flagged",
      "EXPORT: invoice_984102.csv",
    ],
  },
];

export function PipelineExplorer() {
  const [active, setActive] = useState<number>(2);
  const phase = PHASES[active];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      {/* Phase rail */}
      <div className="lg:col-span-5 flex flex-col gap-3">
        {PHASES.map((p, idx) => {
          const Icon = p.icon;
          const isActive = active === idx;
          return (
            <button
              key={p.id}
              onClick={() => setActive(idx)}
className={cn(
                  "group flex items-start gap-4 rounded-xl border px-4 py-3.5 text-left transition-[border-color,background-color,box-shadow] duration-300",
                  isActive
                    ? "border-primary/60 bg-primary/[0.06]"
                    : "border-border/70 hover:border-border hover:bg-foreground/[0.02]"
                )}
            >
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-bold transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "bg-foreground/[0.06] text-foreground/70"
                )}
              >
                {p.num}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "flex items-center gap-2 text-sm font-semibold transition-colors",
                    isActive ? "text-foreground" : "text-foreground/80"
                  )}
                >
                  <Icon className="size-4 text-primary" aria-hidden />
                  {p.title}
                </span>
                <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{p.short}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Phase terminal */}
      <div className="lg:col-span-7">
        <div className="h-full rounded-2xl border border-border/70 bg-foreground/[0.03] p-5 sm:p-6 overflow-hidden relative">
          <div className="mb-5 flex items-center justify-between border-b border-border/70 pb-4">
            <div className="flex items-center gap-2">
              <span className="flex gap-1.5">
                <span className="size-2.5 rounded-full bg-destructive/70" />
                <span className="size-2.5 rounded-full bg-warning/70" />
                <span className="size-2.5 rounded-full bg-positive/70" />
              </span>
              <span className="ml-2 font-mono text-xs text-muted-foreground">sentinel://run-trace</span>
            </div>
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[11px] text-primary">
              PHASE {phase.num}
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={phase.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
            >
              <h3 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                {phase.title}
              </h3>
              <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{phase.desc}</p>

              <div className="mt-6 flex flex-col gap-2">
                {phase.logs.map((l, i) => (
                  <div
                    key={l}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/70 px-3.5 py-2.5 font-mono text-xs text-foreground"
                  >
                    <span className="text-muted-foreground/60">{(i + 1).toString().padStart(2, "0")}</span>
                    <span className="text-primary/70">{"$"}</span>
                    <span className="truncate">{l}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="absolute bottom-4 right-5 hidden items-center gap-1.5 font-mono text-[11px] text-muted-foreground sm:flex">
            <ArrowRight className="size-3" aria-hidden />
            streamed over SSE
          </div>
        </div>
      </div>
    </div>
  );
}