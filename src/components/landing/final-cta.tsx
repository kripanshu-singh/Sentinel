"use client";

import { motion } from "motion/react";
import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  ShieldAlert,
  Activity,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WatchButton } from "@/components/landing/watch-button";

const EASE = [0.16, 1, 0.3, 1] as const;

const PRESET_GOALS = [
  {
    icon: "🛒",
    title: "Sony WH-1000XM5 Price Audit",
    goal: "Search for Sony WH-1000XM5 headphones on Amazon and extract the price.",
    target: "$250.00",
  },
  {
    icon: "⚡",
    title: "boAt Headphone Deal Check",
    goal: "Check if boAt headphones on Flipkart are under ₹1,500.",
    target: "₹1,500",
  },
  {
    icon: "📦",
    title: "Logitech Tech Accessories Search",
    goal: "Search for Logitech wireless mouse on Amazon and verify stock under $20.",
    target: "$20.00",
  },
];

export function FinalCta() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 32, scale: 0.99 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, ease: EASE }}
      className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-b from-background via-muted/20 to-primary/[0.03] px-6 py-12 shadow-xl shadow-foreground/[0.02] md:px-12 md:py-16 lg:px-16 lg:py-20"
    >
      {/* Subtle blueprint grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] opacity-25 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_70%,transparent_100%)]"
        aria-hidden
      />

      {/* Top radial highlight */}
      <div
        className="pointer-events-none absolute -top-32 left-1/2 size-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
        aria-hidden
      />

      <div className="relative z-10 mx-auto max-w-5xl">
        {/* Top Badge & Header */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: EASE }}
            className="mb-6 inline-flex items-center gap-2"
          >
            <Badge
              variant="outline"
              className="gap-2 border-primary/30 bg-primary/10 px-3.5 py-1 font-mono text-xs text-primary"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-primary" />
              </span>
              READY FOR DEPLOYMENT
            </Badge>
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
            className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl"
          >
            Ready to put an AI guard on your{" "}
            <span className="text-primary">order runs?</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.2, ease: EASE }}
            className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg"
          >
            Set a procurement goal, pin a target price ceiling, and let Sentinel navigate vendor storefronts with guaranteed human-in-the-loop safety gates.
          </motion.p>
        </div>

        {/* 2-Column Spec Feature Cards */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.3, ease: EASE }}
          className="mt-10 grid gap-4 sm:grid-cols-2"
        >
          <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/40 hover:shadow-md">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <ShieldAlert className="size-5" aria-hidden />
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">
                  Zero-Unapproved Spend
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sentinel pauses execution at checkout when unit price, tax, or shipping variance exceeds your set threshold.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 font-mono text-xs text-primary">
              <CheckCircle2 className="size-3.5" />
              <span>Blocking Human-in-the-Loop Dialog</span>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 shadow-sm transition-[border-color,box-shadow] duration-300 hover:border-primary/40 hover:shadow-md">
            <div className="flex items-start gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Activity className="size-5" aria-hidden />
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground">
                  Live SSE Event Stream
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Monitor Playwright browser actions line-by-line in real time. Steering instructions apply at the next step boundary.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 font-mono text-xs text-primary">
              <CheckCircle2 className="size-3.5" />
              <span>Live DOM Trace & Real-time Logs</span>
            </div>
          </div>
        </motion.div>

        {/* Preset Workflow Launch Bar */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4, ease: EASE }}
          className="mt-8 rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-6"
        >
          <div className="mb-3 flex items-center gap-2 font-mono text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" aria-hidden />
            <span>Launch a test goal in 1 click:</span>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-3">
            {PRESET_GOALS.map((preset) => (
              <Link
                key={preset.title}
                href={`/app?goal=${encodeURIComponent(preset.goal)}`}
                className="group flex items-center justify-between rounded-xl border border-border/60 bg-background px-3.5 py-3 transition-[border-color,background-color,box-shadow] duration-200 hover:border-primary/50 hover:bg-primary/[0.04] hover:shadow-sm"
              >
                <div className="flex items-center gap-2.5 overflow-hidden">
                  <span className="text-base">{preset.icon}</span>
                  <div className="truncate">
                    <div className="truncate text-xs font-semibold text-foreground group-hover:text-primary">
                      {preset.title}
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">
                      Ceiling: {preset.target}
                    </div>
                  </div>
                </div>
                <ArrowRight
                  className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
                  aria-hidden
                />
              </Link>
            ))}
          </div>
        </motion.div>

        {/* Primary Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/app"
            id="final-cta-launch"
            className="group relative inline-flex h-12 items-center gap-2.5 overflow-hidden rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition-[background-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-xl hover:shadow-primary/30"
          >
            <ShieldCheck className="size-4" aria-hidden />
            <span>Launch the console</span>
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden
            />
          </Link>

          <WatchButton label="Watch live run demo" />
        </motion.div>

        {/* Trust Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-8 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground"
        >
          / ZERO UNAPPROVED SPEND · 100% HUMAN-IN-THE-LOOP /
        </motion.p>
      </div>
    </motion.div>
  );
}