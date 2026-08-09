"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Search,
  Tag,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Scenario {
  id: string;
  name: string;
  vendor: string;
  goal: string;
  targetPrice: string;
  actualPrice: string;
  coupon: string;
  couponStatus: "valid" | "invalid_fallback";
  variance: string;
  discrepancyType: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "supplies",
    name: "Bulk Milk Supplies (50x)",
    vendor: "Target B2B Portal",
    goal: "Build cart with 50x Organic Oat Milk. Target unit price: $3.80. Apply code SUMMER20.",
    targetPrice: "$3.80 / unit",
    actualPrice: "$4.35 / unit",
    coupon: "SUMMER20",
    couponStatus: "invalid_fallback",
    variance: "+$0.55 / unit (+14.4% DRIFT)",
    discrepancyType: "CRITICAL: Unit price exceeds target by 14.4%. Coupon 'SUMMER20' expired.",
  },
  {
    id: "monitors",
    name: "Dell UltraSharp Monitors (10x)",
    vendor: "SauceDemo / B&H Business",
    goal: "Procure 10x Dell UltraSharp 34\" Monitors. Target unit price: $320.00. Apply coupon PROMO50.",
    targetPrice: "$320.00 / unit",
    actualPrice: "$310.00 / unit",
    coupon: "PROMO50",
    couponStatus: "valid",
    variance: "-$10.00 (Savings!)",
    discrepancyType: "Price drop detected — variance within approved threshold (+-$15.00).",
  },
];

export function AgentHeroSimulator() {
  const [selectedId, setSelectedId] = useState<string>("supplies");
  const [simStep, setSimStep] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [approvalAction, setApprovalAction] = useState<"none" | "approved" | "overridden" | "aborted">("none");

  const currentScenario = SCENARIOS.find((s) => s.id === selectedId) || SCENARIOS[0];

  // Auto step timer
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      setSimStep((prev) => {
        if (prev >= 3) {
          // Pause at step 3 for approval
          setIsPlaying(false);
          return 3;
        }
        return prev + 1;
      });
    }, 1800);

    return () => clearTimeout(timer);
  }, [isPlaying, simStep]);

  const handleSelectScenario = (id: string) => {
    setSelectedId(id);
    setSimStep(0);
    setApprovalAction("none");
    setIsPlaying(true);
  };

  const handleReset = () => {
    setSimStep(0);
    setApprovalAction("none");
    setIsPlaying(true);
  };

  const handleAction = (action: "approved" | "overridden" | "aborted") => {
    setApprovalAction(action);
    setSimStep(4);
  };

  return (
    <div className="w-full max-w-4xl mx-auto rounded-2xl border border-border/80 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden text-left relative z-10 my-10">
      {/* Top Bar / Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/40">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-destructive/80 inline-block" />
            <span className="size-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="size-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-xs font-mono text-muted-foreground ml-2 hidden sm:inline-block">
            sentinel-agent // execution-simulator.v01
          </span>
        </div>

        {/* Scenario selector tabs */}
        <div className="flex items-center gap-1.5 bg-background/80 p-1 rounded-lg border border-border/50 text-xs">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelectScenario(s.id)}
              className={cn(
                "px-2.5 py-1 rounded-md transition-all font-medium",
                selectedId === s.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Execution View Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[380px]">
        {/* Left Column: Natural Language Input & Step Timeline */}
        <div className="lg:col-span-5 p-5 border-b lg:border-b-0 lg:border-r border-border/60 flex flex-col justify-between bg-muted/20">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Terminal className="size-3.5 text-primary" />
                Goal Prompt
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                {currentScenario.vendor}
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-background border border-border text-xs leading-relaxed text-foreground font-mono mb-5 shadow-inner">
              <span className="text-primary font-bold">{"> "}</span>
              {currentScenario.goal}
            </div>

            {/* Execution Step Indicators */}
            <div className="space-y-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground block mb-2">
                Execution Progress
              </span>

              {/* Step 1 */}
              <div
                className={cn(
                  "flex items-center gap-3 text-xs p-2.5 rounded-lg transition-all",
                  simStep >= 1
                    ? "bg-primary/10 text-foreground border border-primary/20"
                    : "text-muted-foreground opacity-50"
                )}
              >
                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0",
                    simStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  1
                </div>
                <div className="flex-1">
                  <div className="font-medium">Navigate Portal & Search SKU</div>
                  <div className="text-[10px] text-muted-foreground">Resolving direct storefront URL...</div>
                </div>
                {simStep > 1 && <CheckCircle2 className="size-4 text-primary shrink-0" />}
              </div>

              {/* Step 2 */}
              <div
                className={cn(
                  "flex items-center gap-3 text-xs p-2.5 rounded-lg transition-all",
                  simStep >= 2
                    ? "bg-primary/10 text-foreground border border-primary/20"
                    : "text-muted-foreground opacity-50"
                )}
              >
                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0",
                    simStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  2
                </div>
                <div className="flex-1">
                  <div className="font-medium">Extract Unit Price & Test Promo</div>
                  <div className="text-[10px] text-muted-foreground">Checking target variance ceiling...</div>
                </div>
                {simStep > 2 && <CheckCircle2 className="size-4 text-primary shrink-0" />}
              </div>

              {/* Step 3 */}
              <div
                className={cn(
                  "flex items-center gap-3 text-xs p-2.5 rounded-lg transition-all",
                  simStep >= 3
                    ? currentScenario.couponStatus === "invalid_fallback"
                      ? "bg-amber-500/10 text-foreground border border-amber-500/30"
                      : "bg-primary/10 text-foreground border border-primary/20"
                    : "text-muted-foreground opacity-50"
                )}
              >
                <div
                  className={cn(
                    "size-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold shrink-0",
                    simStep >= 3
                      ? currentScenario.couponStatus === "invalid_fallback"
                        ? "bg-amber-500 text-white"
                        : "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  3
                </div>
                <div className="flex-1">
                  <div className="font-medium">HITL Guardrail Verification</div>
                  <div className="text-[10px] text-muted-foreground">
                    {simStep >= 3
                      ? currentScenario.couponStatus === "invalid_fallback"
                        ? "PAUSED: Discrepancy detected"
                        : "Verified: Within tolerance"
                      : "Waiting for calculation..."}
                  </div>
                </div>
                {simStep >= 3 && (
                  <ShieldCheck
                    className={cn(
                      "size-4 shrink-0",
                      currentScenario.couponStatus === "invalid_fallback" ? "text-amber-500" : "text-primary"
                    )}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Controls bottom bar */}
          <div className="pt-4 mt-4 border-t border-border/50 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
            <span className="text-[11px] font-mono text-muted-foreground">
              {isPlaying ? "Simulating live run..." : simStep >= 4 ? "Execution complete" : "Paused at HITL guardrail"}
            </span>
          </div>
        </div>

        {/* Right Column: Live Agent Screen Simulation & HITL Approval Modal */}
        <div className="lg:col-span-7 p-5 flex flex-col justify-between bg-card relative">
          <AnimatePresence mode="wait">
            {simStep < 3 ? (
              <motion.div
                key="step-loading"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4"
              >
                <div className="relative size-16 flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                  <Search className="size-6 text-primary" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    {simStep === 0 && "Initializing Playwright Browser Worker..."}
                    {simStep === 1 && "Navigating vendor portal & resolving SKU..."}
                    {simStep === 2 && "Inspecting DOM, cart total, & promo code..."}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                    Reading live market rates, applying discount rules, and validating price targets against business rules.
                  </p>
                </div>
              </motion.div>
            ) : simStep === 3 ? (
              /* HITL Approval Modal Simulation */
              <motion.div
                key="step-hitl"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex flex-col justify-between space-y-4"
              >
                {/* Header banner */}
                <div
                  className={cn(
                    "p-3.5 rounded-xl border flex items-start gap-3",
                    currentScenario.couponStatus === "invalid_fallback"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                      : "bg-primary/10 border-primary/30 text-foreground"
                  )}
                >
                  {currentScenario.couponStatus === "invalid_fallback" ? (
                    <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
                  ) : (
                    <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h5 className="text-xs font-semibold uppercase tracking-wider font-mono">
                      {currentScenario.couponStatus === "invalid_fallback"
                        ? "HITL Guardrail Triggered — Human Approval Required"
                        : "Variance Check Passed — Final Review"}
                    </h5>
                    <p className="text-xs mt-0.5 opacity-90 leading-snug">
                      {currentScenario.discrepancyType}
                    </p>
                  </div>
                </div>

                {/* Discrepancy Breakdown Table */}
                <div className="rounded-xl border border-border bg-background p-3.5 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-border/50 text-muted-foreground font-mono text-[11px]">
                    <span>CHECKPOINT PARAMETER</span>
                    <span>EXTRACTED VALUE</span>
                  </div>

                  <div className="flex justify-between items-center font-mono">
                    <span className="text-muted-foreground">Target Unit Price:</span>
                    <span className="font-semibold text-foreground">{currentScenario.targetPrice}</span>
                  </div>

                  <div className="flex justify-between items-center font-mono">
                    <span className="text-muted-foreground">Found Storefront Price:</span>
                    <span
                      className={cn(
                        "font-semibold",
                        currentScenario.couponStatus === "invalid_fallback"
                          ? "text-destructive"
                          : "text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {currentScenario.actualPrice}
                    </span>
                  </div>

                  <div className="flex justify-between items-center font-mono">
                    <span className="text-muted-foreground">Coupon &apos;{currentScenario.coupon}&apos;:</span>
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold uppercase",
                        currentScenario.couponStatus === "valid"
                          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                          : "bg-destructive/10 text-destructive border border-destructive/20"
                      )}
                    >
                      {currentScenario.couponStatus === "valid" ? "VALID (-15%)" : "FAILED / EXPIRED"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-border/50 font-mono text-xs">
                    <span className="font-semibold text-foreground">Variance Delta:</span>
                    <span
                      className={cn(
                        "font-bold px-2 py-0.5 rounded text-xs",
                        currentScenario.couponStatus === "invalid_fallback"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      )}
                    >
                      {currentScenario.variance}
                    </span>
                  </div>
                </div>

                {/* HITL Action buttons */}
                <div className="space-y-2">
                  <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider block">
                    Choose Human Decision:
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction("approved")}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1 font-medium"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("overridden")}
                      className="text-xs gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                    >
                      <Tag className="size-3.5" />
                      Override
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction("aborted")}
                      className="text-xs gap-1 border-destructive/40 text-destructive hover:bg-destructive/10"
                    >
                      <AlertTriangle className="size-3.5" />
                      Abort
                    </Button>
                  </div>
                </div>
              </motion.div>
            ) : (
              /* Execution Outcome Screen */
              <motion.div
                key="step-complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4"
              >
                <div
                  className={cn(
                    "size-14 rounded-2xl flex items-center justify-center shadow-lg",
                    approvalAction === "aborted"
                      ? "bg-destructive/10 text-destructive border border-destructive/30"
                      : approvalAction === "overridden"
                      ? "bg-amber-500/10 text-amber-500 border border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  )}
                >
                  {approvalAction === "aborted" ? (
                    <AlertTriangle className="size-7" />
                  ) : (
                    <ShieldCheck className="size-7" />
                  )}
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-foreground font-mono">
                    {approvalAction === "approved" && "WORKFLOW COMPLETED · APPROVED"}
                    {approvalAction === "overridden" && "WORKFLOW COMPLETED · OVERRIDDEN"}
                    {approvalAction === "aborted" && "WORKFLOW ABORTED BY USER"}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto leading-relaxed">
                    {approvalAction === "aborted"
                      ? "Agent stopped prior to order draft. No funds committed."
                      : "Final cart verified. Normalized invoice generated and ready for CSV export."}
                  </p>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <Button size="sm" onClick={handleReset} variant="outline" className="text-xs gap-1.5">
                    <RotateCcw className="size-3.5" />
                    Run Again
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
