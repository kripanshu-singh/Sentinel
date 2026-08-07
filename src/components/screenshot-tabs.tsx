"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const TABS = [
  {
    id: "goal",
    label: "Goal Input",
    description: "Describe your task in plain English and set business guardrails.",
    src: "/scrn1.webp",
    alt: "Sentinel goal input screen — write a procurement task and set price targets",
  },
  {
    id: "run",
    label: "Live Run",
    description: "Watch the agent work in real time. Approve or steer at any step.",
    src: "/scrn2.webp",
    alt: "Sentinel live run screen — agent timeline, browser screenshot, and HITL approval dialog",
  },
  {
    id: "report",
    label: "Report",
    description: "Review the normalized invoice and export it as CSV.",
    src: "/scrn3.webp",
    alt: "Sentinel result report — reconciliation table with discrepancy flags and CSV export",
  },
] as const;

export function ScreenshotTabs() {
  const [active, setActive] = useState<(typeof TABS)[number]["id"]>("goal");

  const current = TABS.find((t) => t.id === active)!;

  return (
    <div className="mt-16 w-full max-w-4xl mx-auto flex flex-col items-center gap-5 relative z-10">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Application screens"
        className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/60 p-1"
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
              "relative px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active === tab.id
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Description line */}
      <p className="text-sm text-muted-foreground text-center">
        {current.description}
      </p>

      {/* Screenshot panel */}
      {TABS.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
          hidden={active !== tab.id}
          className="w-full"
        >
          <div className="relative w-full rounded-xl overflow-hidden border border-border shadow-lg">
            {/* Bottom fade so it bleeds into the next section */}
            <div
              className="absolute inset-0 pointer-events-none z-10"
              aria-hidden
              style={{
                backgroundImage:
                  "linear-gradient(to bottom, transparent 70%, var(--background) 100%)",
              }}
            />
            <Image
              src={tab.src}
              alt={tab.alt}
              width={1400}
              height={880}
              className="w-full object-cover object-top"
              priority={tab.id === "goal"}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
