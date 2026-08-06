"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button, buttonVariants } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useRunStream } from "@/hooks/use-run-stream";
import type { AgentEvent, Discrepancy, RunStatus, RunSummary } from "@/types";
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
  Lock,
  LoaderCircle,
  ExternalLink,
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

function AgentStreamRow({
  event,
  showSpinner,
  onOpenScreenshot,
}: {
  event: AgentEvent;
  showSpinner: boolean;
  onOpenScreenshot?: () => void;
}) {
  const label = EVENT_LABELS[event.type] ?? event.type;
  const screenshot =
    typeof event.evidence?.screenshot === "string"
      ? event.evidence.screenshot
      : undefined;

  return (
    <div
      className={cn(
        "rounded-xl p-3 text-xs font-mono space-y-2",
        event.status === "error" &&
          "bg-destructive/5 text-destructive border border-destructive/20",
        event.status === "pending" &&
          "bg-primary/5 text-primary border-l-2 border-primary",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-muted-foreground">{event.timestamp}</span>
        <div className="flex items-center gap-2">
          {showSpinner && (
            <span className="size-3 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
          )}
          <span
            className={cn(
              "font-bold uppercase tracking-wide",
              event.status === "success" && "text-primary",
              event.status === "error" && "text-destructive",
              event.status === "pending" && "text-primary",
            )}
          >
            [{label}]
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="text-foreground/80 leading-relaxed">{event.detail}</p>
        {screenshot && (
          <button
            type="button"
            onClick={onOpenScreenshot}
            className="group inline-flex items-center gap-2 rounded-lg border border-border bg-surface p-2 shadow-sm transition hover:border-primary hover:shadow-md"
          >
            <div className="relative h-16 w-24 overflow-hidden rounded-md border border-border bg-background">
              <Image
                src={screenshot}
                alt={event.title}
                fill
                unoptimized
                className="object-cover grayscale group-hover:grayscale-0 transition"
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[11px] font-semibold text-foreground">
                Open screenshot
              </span>
              <span className="text-[10px] text-muted-foreground">
                Click to expand
              </span>
            </div>
            <ExternalLink className="size-3 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

export default function LiveRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const router = useRouter();
  const [runId, setRunId] = useState<string | null>(null);
  const [hitlResolved, setHitlResolved] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideTarget, setOverrideTarget] = useState("");
  const [previewScreenshot, setPreviewScreenshot] = useState<string | null>(
    null,
  );
  const previewOverlayRef = useRef<HTMLDivElement | null>(null);

  // Unwrap async params once on mount
  useEffect(() => {
    params.then((p) => setRunId(p.runId));
  }, [params]);

  const { events, isConnected, error } = useRunStream(runId ?? "");

  const TERMINAL_STATUSES = new Set<RunStatus>(["DONE", "FAILED", "ABORTED"]);

  const { data: summary } = useQuery({
    queryKey: ["run", runId],
    queryFn: async (): Promise<RunSummary> => {
      const res = await fetch(`/api/runs/${encodeURIComponent(runId ?? "")}`);
      if (!res.ok) throw new Error("Failed to fetch run status");
      return res.json();
    },
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && TERMINAL_STATUSES.has(status) ? false : 3000;
    },
  });

  const status = summary?.status;
  const isTerminal = !!status && TERMINAL_STATUSES.has(status);
  const lastErrorEvent = [...events]
    .reverse()
    .find((e) => e.status === "error");

  // Only the most recent pending event is "in flight" — earlier pending rows are
  // resolved, so they render as normal rows instead of spinning forever.
  const latestPendingId = [...events]
    .reverse()
    .find((e) => e.status === "pending")?.id;

  // Latest browser capture + URL surfaced by the worker via event evidence.
  const screenshot = [...events]
    .reverse()
    .find((e) => typeof e.evidence?.screenshot === "string")?.evidence
    ?.screenshot as string | undefined;
  const currentUrl = [...events]
    .reverse()
    .find((e) => typeof e.evidence?.url === "string")?.evidence?.url as
    | string
    | undefined;

  const latestHITLEvent = [...events].reverse().find((e) => e.type === "HITL");

  useEffect(() => {
    if (!previewScreenshot) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewScreenshot(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewScreenshot]);
  const approvalRequest = summary?.currentApprovalRequest;
  const hitlEvent = latestHITLEvent;
  const hitlEvidence =
    hitlEvent?.evidence ??
    (approvalRequest
      ? { discrepancies: approvalRequest.discrepancies }
      : undefined);
  const hitlDiscrepancies = Array.isArray(hitlEvidence?.discrepancies)
    ? (hitlEvidence.discrepancies as Discrepancy[])
    : [];
  const hitlDetail =
    hitlEvent?.detail ??
    approvalRequest?.detail ??
    "Manual intervention required.";
  const hasHITL =
    !hitlResolved &&
    Boolean(hitlEvent || approvalRequest || status === "HITL_PENDING");

  const STEPS = [
    { label: "Search", done: true, icon: Search },
    { label: "Reconcile", done: true, icon: CheckCheck },
    { label: "HITL Check", done: hitlResolved, active: hasHITL, icon: Gavel },
    { label: "Checkout", done: false, icon: ShoppingCart },
  ];

  async function postResolve(
    action: "approve" | "override" | "abort",
    body: object = {},
  ) {
    if (!runId) return;
    setIsResolving(true);
    setResolveError(null);
    try {
      const res = await fetch(
        `/api/runs/${encodeURIComponent(runId)}/resolve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ...body }),
        },
      );
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Error ${res.status}`);
      }
    } catch (err: unknown) {
      setResolveError(err instanceof Error ? err.message : "Resolution failed");
      setIsResolving(false);
      return;
    }
    setIsResolving(false);
  }

  async function handleApprove() {
    await postResolve("approve");
    setHitlResolved(true);
  }

  async function handleOverride() {
    const target = parseFloat(overrideTarget);
    if (!Number.isFinite(target) || target <= 0) return;
    await postResolve("override", { overrideTarget: target });
    setHitlResolved(true);
  }

  async function handleAbort() {
    await postResolve("abort");
    if (runId) router.push(`/runs/${encodeURIComponent(runId)}/result`);
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
            <span className="text-foreground font-semibold">
              Run ID: {runId ?? "…"}
            </span>
            {isTerminal ? (
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ml-1",
                  status === "DONE" && "bg-primary/10 text-primary",
                  (status === "FAILED" || status === "ABORTED") &&
                    "bg-destructive/10 text-destructive",
                )}
              >
                {status}
              </span>
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary ml-1">
                {isConnected ? "Live" : "Connecting…"}
              </span>
            )}
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
        {/* Terminal-state banner */}
        {status === "FAILED" && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-destructive">Run failed</h3>
              <p className="text-xs text-destructive/80 mt-0.5">
                {lastErrorEvent?.detail ??
                  "The goal could not be executed. Please try again with more detail."}
              </p>
            </div>
          </div>
        )}
        {status === "DONE" && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="size-5 text-primary shrink-0" />
            <p className="text-sm font-semibold text-primary">Run complete</p>
          </div>
        )}
        {status === "ABORTED" && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 flex items-center gap-3">
            <XCircle className="size-5 text-destructive shrink-0" />
            <p className="text-sm font-semibold text-destructive">
              Run aborted
            </p>
          </div>
        )}

        {/* Progress Stepper */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shrink-0">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center gap-1 min-w-20">
                  <div
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center relative",
                      step.done && "bg-primary text-primary-foreground",
                      step.active &&
                        !step.done &&
                        "border-2 border-primary bg-primary/10 text-primary",
                      !step.done &&
                        !step.active &&
                        "border-2 border-border bg-background text-muted-foreground opacity-50",
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
                          : "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-px mx-2",
                      step.done ? "bg-primary" : "bg-border",
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
          <div className="col-span-3 bg-card border border-border rounded-xl overflow-hidden h-[640px]">
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
              className="h-full min-h-0 overflow-y-auto p-3 flex flex-col gap-2"
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
                <AgentStreamRow
                  key={event.id}
                  event={event}
                  showSpinner={
                    event.status === "pending" &&
                    event.id === latestPendingId &&
                    !isTerminal
                  }
                  onOpenScreenshot={() => {
                    const screenshotUrl =
                      typeof event.evidence?.screenshot === "string"
                        ? event.evidence.screenshot
                        : undefined;
                    if (screenshotUrl) setPreviewScreenshot(screenshotUrl);
                  }}
                />
              ))}
            </div>
          </div>

          {/* Center pane: live browser capture */}
          <div className="col-span-6 bg-card border border-border rounded-xl flex flex-col overflow-hidden min-h-0">
            {/* Browser chrome */}
            <div className="px-3 py-2 border-b border-border bg-muted/40 flex items-center gap-2 shrink-0">
              <div className="flex gap-1.5">
                <div className="size-3 rounded-full bg-destructive/70" />
                <div className="size-3 rounded-full bg-muted-foreground/40" />
                <div className="size-3 rounded-full bg-primary/70" />
              </div>
              <div className="flex-1 bg-card rounded-md px-3 py-1 text-xs font-mono text-muted-foreground flex items-center gap-1.5 border border-border truncate">
                <Lock className="size-3 shrink-0" />
                {currentUrl ?? "https://www.saucedemo.com/"}
              </div>
            </div>

            {/* Live screenshot from the worker */}
            <div className="flex-1 min-h-0 bg-background relative overflow-hidden flex items-center justify-center">
              {screenshot ? (
                <Image
                  src={screenshot}
                  alt="Latest browser capture"
                  fill
                  unoptimized
                  className="object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <LoaderCircle className="size-6 animate-spin" />
                  <p className="text-xs font-mono">
                    Waiting for browser capture…
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right pane: HITL control */}
          <div className="col-span-3 flex flex-col gap-4 min-h-0">
            {/* HITL Alert */}
            {hasHITL && (
              <div className="bg-card border-2 border-destructive/30 rounded-xl overflow-hidden shadow-lg">
                <div className="bg-destructive/10 px-4 py-3 flex items-start gap-3 border-b border-destructive/20">
                  <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Variance Alert
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Manual intervention required.
                    </p>
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  {/* Data comparison */}
                  {hitlDiscrepancies.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {hitlDiscrepancies.map((d, i) => (
                        <div
                          key={i}
                          className="flex justify-between items-center border-b border-border pb-2 text-sm last:border-0 last:pb-0"
                        >
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                              {d.kind} variance
                            </span>
                            <span className="text-xs text-muted-foreground">
                              expected {String(d.expected)} → found{" "}
                              {String(d.actual)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-destructive">
                              {d.variancePct > 0 ? "+" : ""}
                              {d.variancePct}%
                            </span>
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase",
                                d.severity === "high"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-primary/10 text-primary",
                              )}
                            >
                              {d.severity}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {hitlDetail}
                    </p>
                  )}

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
                    <Button
                      variant="outline"
                      className="w-full gap-2"
                      size="sm"
                      disabled={isResolving}
                      onClick={() => setOverrideOpen((o) => !o)}
                    >
                      <Edit3 className="size-4" />
                      Override Target
                    </Button>
                    {overrideOpen && (
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={overrideTarget}
                          onChange={(e) => setOverrideTarget(e.target.value)}
                          placeholder="New target $"
                          className="flex-1 px-3 py-2 border border-border rounded-lg bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                        />
                        <Button
                          size="sm"
                          disabled={isResolving || !overrideTarget}
                          onClick={handleOverride}
                        >
                          Apply
                        </Button>
                      </div>
                    )}
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
                    {resolveError && (
                      <p
                        role="alert"
                        className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1"
                      >
                        {resolveError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {hitlResolved && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 className="size-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-primary">Approved</p>
                  <p className="text-xs text-muted-foreground">
                    Agent resuming checkout…
                  </p>
                </div>
              </div>
            )}

            {/* Run context */}
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Run Goal
              </h4>
              <p className="text-xs text-foreground leading-relaxed">
                {summary?.goal ?? "…"}
              </p>
            </div>

            {/* View Result link */}
            {status === "DONE" && (
              <Link
                href={`/runs/${encodeURIComponent(runId ?? "")}/result`}
                className={cn(buttonVariants({ variant: "outline" }), "w-full")}
              >
                View Result Report →
              </Link>
            )}
          </div>
        </div>
      </main>
      {previewScreenshot && (
        <div
          ref={previewOverlayRef}
          onClick={(event) => {
            if (event.target === previewOverlayRef.current) {
              setPreviewScreenshot(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewScreenshot(null)}
              className="absolute right-3 top-3 rounded-full bg-background/90 px-3 py-2 text-xs font-semibold text-foreground shadow hover:bg-background"
            >
              Close
            </button>
            <div className="relative h-[80vh] w-[80vw] max-w-[1200px] max-h-[800px]">
              <Image
                src={previewScreenshot}
                alt="Expanded screenshot"
                fill
                unoptimized
                className="object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </SidebarInset>
  );
}
