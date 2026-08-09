"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { Lock } from "lucide-react";

import scrn1 from "../../public/scrn1.webp";
import scrn2 from "../../public/scrn2.webp";
import scrn3 from "../../public/scrn3.webp";

const TABS = [
  {
    id: "goal",
    label: "01. Goal & Guardrails",
    description: "Write your procurement prompt in natural language and configure strict price ceiling thresholds.",
    path: "sentinel.ai/app/new-run",
    src: scrn1,
    alt: "Sentinel goal input screen: write a procurement task and set price targets",
    highlights: [
      { text: "Natural language goal parser", x: "25%", y: "30%" },
      { text: "Variance ceiling threshold", x: "75%", y: "45%" },
    ],
  },
  {
    id: "run",
    label: "02. Real-Time Execution",
    description: "Watch Sentinel navigate vendor portals live with real-time event logs and blocking HITL approval modals.",
    path: "sentinel.ai/app/runs/run_984102",
    src: scrn2,
    alt: "Sentinel live run screen with agent timeline, browser screenshot, and HITL approval dialog",
    highlights: [
      { text: "Live SSE event stream", x: "20%", y: "40%" },
      { text: "Human-in-the-loop modal", x: "60%", y: "50%" },
    ],
  },
  {
    id: "report",
    label: "03. Normalized Invoice",
    description: "Inspect the final itemized invoice summary with discrepancy flags and export directly to CSV.",
    path: "sentinel.ai/app/runs/run_984102/report",
    src: scrn3,
    alt: "Sentinel result report: reconciliation table with discrepancy flags and CSV export",
    highlights: [
      { text: "Itemized price variance matrix", x: "40%", y: "35%" },
      { text: "One-click CSV Export", x: "85%", y: "25%" },
    ],
  },
] as const;

export function ScreenshotTabs() {
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("goal");

  const current = TABS.find((t) => t.id === active)!;

  return (
    <div className="mt-16 w-full max-w-5xl mx-auto flex flex-col items-center gap-6 relative z-10">
      {/* Tab bar selector */}
      <div
        role="tablist"
        aria-label="Application screens"
        className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-muted/60 p-1.5 backdrop-blur-md shadow-lg"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActive(tab.id)}
            className={cn(
              "relative px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-[color,background-color,box-shadow,border-color] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-ring font-mono",
              active === tab.id
                ? "bg-card text-foreground shadow-md border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Screen Sub-description */}
      <p className="text-sm text-muted-foreground text-center max-w-lg leading-relaxed font-sans">
        {current.description}
      </p>

      {/* Upgraded Browser Mockup Chrome */}
      <div className="w-full rounded-2xl overflow-hidden border border-border/80 bg-card/90 shadow-2xl backdrop-blur-xl relative">
        {/* Browser Top Navigation Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border/60 text-xs font-mono text-muted-foreground">
          {/* Traffic lights */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="size-3 rounded-full bg-destructive/80 inline-block" />
              <span className="size-3 rounded-full bg-warning/80 inline-block" />
              <span className="size-3 rounded-full bg-positive/80 inline-block" />
            </div>
          </div>

          {/* URL bar */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-md bg-background/80 border border-border/50 text-foreground text-xs max-w-xs sm:max-w-md w-full justify-center shadow-inner font-mono">
            <Lock className="size-3 text-primary shrink-0" />
            <span className="truncate">{current.path}</span>
          </div>

          {/* Live Indicator */}
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-positive animate-pulse motion-reduce:animate-none" />
            <span className="text-xs text-positive font-semibold uppercase tracking-wider hidden sm:inline">
              Guardrails Active
            </span>
          </div>
        </div>

        {/* Screenshot Viewport Container */}
        <div className="relative w-full aspect-[16/10] bg-background">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              className="absolute inset-0 w-full h-full"
            >
              <Image
                src={current.src}
                alt={current.alt}
                fill
                priority={current.id === "goal"}
                className="w-full h-full object-cover object-top"
              />

              {/* Bottom gradient fade into section background */}
              <div
                className="absolute inset-0 pointer-events-none z-10"
                aria-hidden
                style={{
                  backgroundImage:
                    "linear-gradient(to bottom, transparent 65%, var(--background) 100%)",
                }}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
