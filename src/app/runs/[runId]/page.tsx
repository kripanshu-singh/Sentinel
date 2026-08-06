"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useRunStream } from "@/hooks/use-run-stream";
import type { AgentEvent } from "@/types";
import {
  Bell,
  HelpCircle,
  ChevronRight,
  CheckCircle2,
  Gavel,
  ShoppingCart,
  Search,
  Terminal,
  AlertTriangle,
  CheckCheck,
  XCircle,
  Edit3,
} from "lucide-react";


const EVENT_LABELS: Record<string, string> = {
  NAVIGATE: "NAV",
  SEARCH: "SEARCH",
  EXTRACT: "PARSE",
  CHECK: "EVAL",
  HITL: "HALT",
  FORM_FILL: "FILL",
  VALIDATE: "VALIDATE",
  RECOVER: "RECOVER",
  DRAFT: "DRAFT",
};

function AgentStreamRow({ event }: { event: AgentEvent }) {
  const label = EVENT_LABELS[event.type] ?? event.type;

  return (
    <div
      className={cn(
        "flex gap-3 text-xs font-mono py-1.5",
        event.status === "error" &&
          "bg-destructive/5 text-destructive -mx-3 px-3 rounded border border-destructive/20",
        event.status === "pending" &&
          "bg-primary/5 text-primary -mx-3 px-3 rounded border-l-2 border-primary"
      )}
    >
      <span className="text-muted-foreground shrink-0">{event.timestamp}</span>
      <div className="flex items-start gap-1.5">
        <span
          className={cn(
            "font-bold shrink-0",
            event.status === "success" && "text-primary",
            event.status === "error" && "text-destructive",
            event.status === "pending" && "text-primary"
          )}
        >
          [{label}]
        </span>
        <span className="text-foreground/80 leading-relaxed">{event.detail}</span>
        {event.status === "pending" && (
          <span className="size-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0 mt-0.5" />
        )}
      </div>
    </div>
  );
}

export default function LiveRunPage() {
  const router = useRouter();
  const [runId] = useState("1");
  const { events, isConnected, error } = useRunStream(runId);
  const [hitlResolved, setHitlResolved] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const hasHITL = events.some((e) => e.type === "HITL") && !hitlResolved;

  const STEPS = [
    { label: "Search", done: true, icon: Search },
    { label: "Reconcile", done: true, icon: CheckCheck },
    { label: "HITL Check", done: hitlResolved, active: hasHITL, icon: Gavel },
    { label: "Checkout", done: false, icon: ShoppingCart },
  ];

  async function handleApprove() {
    setIsResolving(true);
    await new Promise((r) => setTimeout(r, 1200));
    setHitlResolved(true);
    setIsResolving(false);
  }

  async function handleAbort() {
    setIsResolving(true);
    await new Promise((r) => setTimeout(r, 800));
    router.push("/runs/1/result");
  }

  return (
    <SidebarInset>
      {/* Top Bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Agent Runs</span>
            <ChevronRight className="size-4" />
            <span className="text-foreground font-semibold">Run ID: PRQ-8992</span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary ml-1">
              {isConnected ? "Live" : "Connecting…"}
            </span>
          </div>
        </div>
          <div className="flex items-center gap-3">
            <button className="text-muted-foreground hover:text-primary transition-colors">
              <Bell className="size-4" />
            </button>
            <button className="text-muted-foreground hover:text-primary transition-colors">
              <HelpCircle className="size-4" />
            </button>
            <div className="size-8 rounded-full bg-muted border border-border flex items-center justify-center">
              <span className="text-primary text-xs font-semibold">EA</span>
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col gap-5 p-6 overflow-hidden">
          {/* Progress Stepper */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center flex-1">
                  <div className="flex flex-col items-center gap-1 min-w-20">
                    <div
                      className={cn(
                        "size-8 rounded-full flex items-center justify-center relative",
                        step.done && "bg-primary text-primary-foreground",
                        step.active && !step.done &&
                          "border-2 border-primary bg-primary/10 text-primary",
                        !step.done && !step.active &&
                          "border-2 border-border bg-background text-muted-foreground opacity-50"
                      )}
                    >
                      {step.done ? (
                        <CheckCheck className="size-4" />
                      ) : (
                        <Icon className="size-4" />
                      )}
                      {step.active && !step.done && (
                        <span className="absolute -top-1 -right-1 size-3 bg-destructive rounded-full border-2 border-card animate-pulse" />
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium",
                        step.active && !step.done
                          ? "text-primary font-bold"
                          : step.done
                          ? "text-foreground"
                          : "text-muted-foreground"
                      )}
                    >
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "flex-1 h-px mx-2",
                        step.done ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Three-pane layout */}
          <div className="flex-1 grid grid-cols-12 gap-5 min-h-0">
            {/* Left pane: Agent stream */}
            <div className="col-span-3 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Terminal className="size-4" />
                  Agent Stream
                </h2>
                <span className="text-[10px] font-mono bg-accent text-muted-foreground px-2 py-0.5 rounded">
                  v2.4.1
                </span>
              </div>
              <div
                className="flex-1 overflow-y-auto p-3 flex flex-col gap-0.5"
                style={{ scrollbarWidth: "thin" }}
              >
                {error && (
                  <div className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1 mb-2">
                    {error}
                  </div>
                )}
                {events.length === 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-8 bg-muted rounded animate-pulse"
                      />
                    ))}
                  </div>
                )}
                {events.map((event) => (
                  <AgentStreamRow key={event.id} event={event} />
                ))}
              </div>
            </div>

            {/* Center pane: Vendor portal preview */}
            <div className="col-span-6 bg-card border border-border rounded-xl flex flex-col overflow-hidden">
              {/* Browser chrome */}
              <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-destructive/70" />
                  <div className="size-3 rounded-full bg-muted-foreground/40" />
                  <div className="size-3 rounded-full bg-primary/70" />
                </div>
                <div className="flex-1 bg-card rounded-md px-3 py-1 text-xs font-mono text-muted-foreground flex items-center gap-1.5 border border-border">
                  <span className="text-[10px]">🔒</span>
                  vendor-portal.supplier-network.com/item/ALM-BAR-1L
                </div>
              </div>

              {/* Simulated vendor page */}
              <div className="flex-1 bg-white relative overflow-auto p-8">
                {/* Agent control overlay */}
                <div className="absolute inset-0 bg-primary/[0.03] pointer-events-none border-2 border-primary/15 z-10" />

                <div className="max-w-xl mx-auto flex gap-8">
                  {/* Product image */}
                  <div className="w-48 shrink-0">
                    <div className="aspect-square bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-center relative">
                      <div className="absolute inset-2 border-2 border-dashed border-primary/50 rounded animate-pulse" />
                      <div className="text-gray-300 text-6xl select-none">🥛</div>
                    </div>
                  </div>

                  {/* Product details */}
                  <div className="flex-1">
                    <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mb-1">
                      Pantry Supplies
                    </p>
                    <h3 className="text-xl font-bold text-gray-900 leading-tight mb-2">
                      Premium Barista Almond Milk — 1L
                    </h3>
                    <p className="text-sm text-gray-500 mb-5">
                      Professional grade almond milk formulated for coffee
                      applications. Steams perfectly.
                    </p>

                    {/* Flagged price box */}
                    <div className="relative mb-5 pb-5 border-b border-gray-200">
                      <div className="absolute -inset-2 bg-red-50 border border-red-200 rounded pointer-events-none" />
                      <div className="relative text-3xl font-bold text-gray-900 mb-1">
                        $4.80
                        <span className="text-sm font-normal text-gray-500 ml-1">
                          / unit
                        </span>
                      </div>
                      <div className="relative flex items-center gap-1 text-xs text-red-600 font-medium">
                        ↑ +20% vs target ($4.00)
                      </div>
                    </div>

                    <div className="flex items-center gap-3 mb-5">
                      <div className="flex items-center border border-gray-200 rounded-lg px-3 py-1.5 gap-3 text-sm">
                        <span className="text-gray-400">−</span>
                        <span className="font-semibold">24</span>
                        <span className="text-gray-400">+</span>
                      </div>
                      <span className="text-sm text-gray-500">units requested</span>
                    </div>

                    <button className="w-full bg-gray-100 text-gray-400 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed flex items-center justify-center gap-2">
                      <ShoppingCart className="size-4" />
                      Add to Cart (Agent Controlled)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right pane: HITL control */}
            <div className="col-span-3 flex flex-col gap-4">
              {/* HITL Alert */}
              {hasHITL && (
                <div className="bg-card border-2 border-destructive/30 rounded-xl overflow-hidden shadow-lg">
                  <div className="bg-destructive/10 px-4 py-3 flex items-start gap-3 border-b border-destructive/20">
                    <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Variance Alert</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Manual intervention required.
                      </p>
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-4">
                    {/* Data comparison */}
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center border-b border-border pb-2 text-sm">
                        <span className="text-muted-foreground">Target Price</span>
                        <span className="font-mono font-medium">$4.00</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-border pb-2 text-sm">
                        <span className="text-muted-foreground">Found Price</span>
                        <span className="font-mono font-medium text-destructive">$4.80</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Total Impact</span>
                        <span className="font-mono font-bold">
                          +$19.20{" "}
                          <span className="text-[10px] font-normal text-muted-foreground">
                            (24 units)
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2">
                      <Button
                        className="w-full gap-2"
                        size="sm"
                        disabled={isResolving}
                        onClick={handleApprove}
                      >
                        {isResolving ? (
                          <span className="size-3.5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-4" />
                        )}
                        Approve &amp; Continue
                      </Button>
                      <Button variant="outline" className="w-full gap-2" size="sm" disabled={isResolving}>
                        <Edit3 className="size-4" />
                        Override Target
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                        size="sm"
                        disabled={isResolving}
                        onClick={handleAbort}
                      >
                        <XCircle className="size-4" />
                        Abort Task
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {hitlResolved && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="size-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-primary">Approved</p>
                    <p className="text-xs text-muted-foreground">Agent resuming checkout…</p>
                  </div>
                </div>
              )}

              {/* Rule context */}
              <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Rule Context
                </h4>
                <p className="text-xs text-foreground leading-relaxed">
                  Auto-approval threshold is{" "}
                  <span className="font-semibold text-primary">+5%</span> for
                  category{" "}
                  <code className="bg-accent px-1 rounded text-[11px]">PANTRY</code>.
                  Current variance (+20%) triggers mandatory HITL review.
                </p>
                <button className="text-primary text-xs hover:underline flex items-center gap-1 w-max mt-1">
                  View Policy Details →
                </button>
              </div>

              {/* View Result link */}
              {hitlResolved && (
                <Link
                  href="/runs/1/result"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full")}
                >
                  View Result Report →
                </Link>
              )}
            </div>
          </div>
        </main>
      </SidebarInset>
  );
}
