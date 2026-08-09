"use client";

import React, { useState } from "react";
import { motion } from "motion/react";
import { DollarSign, Clock, ShieldCheck, Sparkles, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function ProcurementRoiCalculator() {
  const [poCount, setPoCount] = useState<number>(250);
  const [avgPoValue, setAvgPoValue] = useState<number>(2400);
  const [leakageRate, setLeakageRate] = useState<number>(3.5);

  // Calculations
  const monthlyTotalSpend = poCount * avgPoValue;
  const annualTotalSpend = monthlyTotalSpend * 12;
  const annualSavingsPrevented = (annualTotalSpend * (leakageRate / 100));
  const monthlyHoursSaved = Math.round(poCount * 0.45); // ~27 mins manual reconciliation saved per PO

  const formattedAnnualSavings = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(annualSavingsPrevented);

  const formattedAnnualSpend = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(annualTotalSpend);

  return (
    <div className="w-full max-w-5xl mx-auto rounded-3xl border border-border/80 bg-gradient-to-b from-card/90 via-card/60 to-background/90 backdrop-blur-2xl p-6 sm:p-10 shadow-2xl relative overflow-hidden text-left my-16">
      {/* Subtle glow background */}
      <div
        className="absolute top-0 right-0 w-96 h-96 pointer-events-none opacity-15"
        style={{
          backgroundImage:
            "radial-gradient(circle at 100% 0%, #6bd8cb 0%, transparent 70%)",
        }}
        aria-hidden
      />

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10 pb-6 border-b border-border/60 relative z-10">
        <div>
          <span className="font-mono text-xs text-primary font-semibold uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <Sparkles className="size-3.5" />
            ROI & Risk Impact Calculator
          </span>
          <h3 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            Calculate your price leakage & audit savings.
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-lg">
            Unverified vendor price creep and expired promo codes cost B2B buyers thousands monthly. See what Sentinel guardrails protect.
          </p>
        </div>

        <div className="text-right shrink-0">
          <span className="text-xs text-muted-foreground font-mono block">Estimated Annual Procurement Spend</span>
          <span className="text-xl sm:text-2xl font-bold font-mono text-foreground">{formattedAnnualSpend} / yr</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">
        {/* Sliders Input Area */}
        <div className="lg:col-span-6 space-y-6">
          {/* Slider 1: Monthly PO Volume */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <label htmlFor="po-count-slider" className="text-foreground flex items-center gap-2">
                Monthly PO Volume:
              </label>
              <span className="font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                {poCount} orders/mo
              </span>
            </div>
            <input
              id="po-count-slider"
              type="range"
              min={20}
              max={1000}
              step={10}
              value={poCount}
              onChange={(e) => setPoCount(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>20 orders</span>
              <span>500 orders</span>
              <span>1,000 orders</span>
            </div>
          </div>

          {/* Slider 2: Avg PO Value */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <label htmlFor="avg-po-slider" className="text-foreground">
                Average Order Value ($):
              </label>
              <span className="font-mono font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                ${avgPoValue.toLocaleString()}
              </span>
            </div>
            <input
              id="avg-po-slider"
              type="range"
              min={200}
              max={25000}
              step={100}
              value={avgPoValue}
              onChange={(e) => setAvgPoValue(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>$200</span>
              <span>$10,000</span>
              <span>$25,000</span>
            </div>
          </div>

          {/* Slider 3: Price Leakage % */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
              <label htmlFor="leakage-slider" className="text-foreground">
                Expected Price Variance / Uncaught Drift:
              </label>
              <span className="font-mono font-bold text-amber-500 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                {leakageRate}%
              </span>
            </div>
            <input
              id="leakage-slider"
              type="range"
              min={1.0}
              max={10.0}
              step={0.5}
              value={leakageRate}
              onChange={(e) => setLeakageRate(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>1.0% (Conservative)</span>
              <span>3.5% (Industry Avg)</span>
              <span>10.0% (High Leakage)</span>
            </div>
          </div>
        </div>

        {/* Results Cards */}
        <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card 1: Dollars Saved */}
          <motion.div
            key={formattedAnnualSavings}
            initial={{ scale: 0.97, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-5 rounded-2xl border border-primary/30 bg-primary/5 dark:bg-primary/10 flex flex-col justify-between"
          >
            <div>
              <div className="size-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center mb-3">
                <DollarSign className="size-5" />
              </div>
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Leakage Prevented
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-primary mt-1">
                {formattedAnnualSavings}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 leading-snug">
              Prevented from unverified unit price drift & failed discount codes.
            </p>
          </motion.div>

          {/* Card 2: Hours Saved */}
          <motion.div
            key={monthlyHoursSaved}
            initial={{ scale: 0.97, opacity: 0.8 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-5 rounded-2xl border border-border bg-card flex flex-col justify-between"
          >
            <div>
              <div className="size-9 rounded-xl bg-muted text-foreground flex items-center justify-center mb-3">
                <Clock className="size-5" />
              </div>
              <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Reconciliation Time
              </span>
              <div className="text-2xl sm:text-3xl font-bold font-mono text-foreground mt-1">
                {monthlyHoursSaved} hrs/mo
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 leading-snug">
              Automated storefront navigation & normalized line-item extraction.
            </p>
          </motion.div>

          {/* Card 3: Full Width Guardrail Banner */}
          <div className="sm:col-span-2 p-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-500/15 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider font-mono text-emerald-700 dark:text-emerald-300 block">
                  100% HITL Guardrail Guarantee
                </span>
                <p className="text-xs text-muted-foreground leading-snug">
                  Zero unauthorized checkout submissions — Sentinel pauses for human approval on high-stakes drift.
                </p>
              </div>
            </div>

            <Button render={<Link href="/app" />} size="sm" className="hidden sm:flex shrink-0 gap-1 font-semibold">
              Try a Run
              <ArrowUpRight className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
