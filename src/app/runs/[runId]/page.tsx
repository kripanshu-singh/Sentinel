"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button, buttonVariants } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { SentinelNavbar } from "@/components/sentinel-navbar";
import { useRunStream } from "@/hooks/use-run-stream";
import { buildPhases } from "@/lib/run-progress";
import { Badge } from "@/components/ui/badge";
import type { AgentEvent, Discrepancy, RunStatus, RunSummary } from "@/types";
import {
  CheckCircle2,
  Terminal,
  AlertTriangle,
  CheckCheck,
  XCircle,
  Edit3,
  Lock,
  LoaderCircle,
  ExternalLink,
  Send,
  ChevronRight,
  Monitor,
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
        "rounded-lg p-3 text-xs border border-border/50 bg-background transition-all",
        event.status === "error" &&
          "bg-destructive/5 border-destructive/25",
        event.status === "pending" &&
          "bg-primary/5 border-l-2 border-primary",
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <span className="text-[10px] text-muted-foreground font-mono tabular-nums shrink-0 mt-0.5">
          {event.timestamp}
        </span>
        <div className="flex items-center gap-1.5 shrink-0">
          {showSpinner && (
            <span className="size-2.5 rounded-full border-2 border-primary/30 border-t-primary animate-spin shrink-0" />
          )}
          <span
            className={cn(
              "font-bold uppercase tracking-wider text-[10px] font-mono",
              event.status === "success" && "text-primary",
              event.status === "error" && "text-destructive",
              event.status === "pending" && "text-primary",
              event.status !== "success" && event.status !== "error" && event.status !== "pending" && "text-muted-foreground",
            )}
          >
            {label}
          </span>
        </div>
      </div>
      <p className="text-foreground/80 leading-relaxed text-xs mb-2">
        {event.detail}
      </p>
      {screenshot && (
        <button
          type="button"
          onClick={onOpenScreenshot}
          className="group inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-1.5 transition hover:border-primary/40 hover:bg-muted/60 w-full"
        >
          <div className="relative h-10 w-16 overflow-hidden rounded border border-border/60 bg-background shrink-0">
            <Image
              src={screenshot}
              alt={event.title}
              fill
              unoptimized
              className="object-cover grayscale group-hover:grayscale-0 transition duration-300"
            />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className="text-[10px] font-semibold text-foreground">
              View screenshot
            </span>
            <span className="text-[9px] text-muted-foreground">
              Click to expand
            </span>
          </div>
          <ExternalLink className="size-3 text-muted-foreground ml-auto group-hover:text-primary transition-colors shrink-0" />
        </button>
      )}
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
  const [instruction, setInstruction] = useState("");
  const previewOverlayRef = useRef<HTMLDivElement | null>(null);
  const logBottomRef = useRef<HTMLDivElement | null>(null);

  // Unwrap async params once on mount
  useEffect(() => {
    params.then((p) => setRunId(p.runId));
  }, [params]);

  const { events, isConnected, error } = useRunStream(runId ?? "");

  // Auto-scroll agent log to bottom when new events arrive
  useEffect(() => {
    logBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

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
      if (!status) return 3000;
      if (TERMINAL_STATUSES.has(status)) return false;
      if (status === "HITL_PENDING") return 1000;
      return 3000;
    },
  });

  const status = summary?.status;
  const isTerminal = !!status && TERMINAL_STATUSES.has(status);
  const lastErrorEvent = [...events]
    .reverse()
    .find((e) => e.status === "error");

  const latestPendingId = [...events]
    .reverse()
    .find((e) => e.status === "pending")?.id;

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
      if (event.key === "Escape") setPreviewScreenshot(null);
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
    Boolean(
      (hitlEvent && hitlEvent.status === "pending") ||
      approvalRequest ||
      status === "HITL_PENDING"
    );

  const phases = buildPhases(events, status);

  async function postResolve(
    action: "approve" | "override" | "abort" | "custom",
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

  async function handleCustomInstruction() {
    const trimmed = instruction.trim();
    if (!trimmed) return;
    await postResolve("custom", { instruction: trimmed });
    setHitlResolved(true);
  }

  async function handleAbort() {
    await postResolve("abort");
    if (runId) router.push(`/runs/${encodeURIComponent(runId)}/result`);
  }

  return (
    <SidebarInset>
      <SentinelNavbar
        breadcrumbs={[
          { label: "Runs", href: "/" },
          { label: runId ? `Run ${runId.slice(0, 8)}…` : "…" },
        ]}
        statusBadge={
          isTerminal
            ? {
                label: status ?? "",
                variant:
                  status === "DONE" ? "primary" : "destructive",
              }
            : {
                label: isConnected ? "Live" : "Connecting…",
                variant: "primary",
              }
        }
      />

      {/* Page scrolls naturally — no fixed heights, no overflow:hidden on main */}
      <main className="min-h-[calc(100dvh-3.5rem)] bg-background">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col gap-6">

          {/* ── Terminal-state banners ── */}
          {status === "FAILED" && (
            <div className="bg-destructive/8 border border-destructive/25 rounded-xl px-5 py-4 flex items-start gap-3">
              <AlertTriangle className="size-4 text-destructive shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-destructive">Run failed</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  {lastErrorEvent?.detail ??
                    "The goal could not be executed. Please try again with more detail."}
                </p>
              </div>
            </div>
          )}
          {status === "DONE" && (
            <div className="bg-primary/8 border border-primary/20 rounded-xl px-5 py-4 flex items-center gap-3">
              <CheckCircle2 className="size-4 text-primary shrink-0" />
              <div>
                <p className="text-sm font-semibold text-primary">Run complete</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The agent has finished executing your goal.
                </p>
              </div>
              <Link
                href={`/runs/${encodeURIComponent(runId ?? "")}/result`}
                className={cn(buttonVariants({ size: "sm" }), "ml-auto shrink-0")}
              >
                View Report →
              </Link>
            </div>
          )}
          {status === "ABORTED" && (
            <div className="bg-destructive/8 border border-destructive/25 rounded-xl px-5 py-4 flex items-center gap-3">
              <XCircle className="size-4 text-destructive shrink-0" />
              <p className="text-sm font-semibold text-destructive">Run aborted</p>
            </div>
          )}

          {/* ── Progress stepper ── */}
          <div className="bg-card border border-border rounded-xl px-6 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Workflow Progress
              </span>
              <span className="text-xs text-muted-foreground">
                {status === "DONE" && "Completed"}
                {status === "FAILED" && "Failed"}
                {status === "ABORTED" && "Aborted"}
                {!isTerminal && (isConnected ? "Running…" : "Connecting…")}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {phases.map((phase, i) => (
                <div key={phase.id} className="flex items-center gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "size-5 rounded-full flex items-center justify-center text-[10px] transition-all shrink-0",
                        phase.done && "bg-primary text-primary-foreground",
                        phase.active && !phase.done &&
                          "border-2 border-primary bg-primary/10 text-primary animate-pulse",
                        phase.error && "bg-destructive/15 text-destructive border border-destructive/40",
                        !phase.done && !phase.active && !phase.error &&
                          "border border-border bg-background text-muted-foreground/50",
                      )}
                    >
                      {phase.done ? (
                        <CheckCheck className="size-2.5" />
                      ) : phase.error ? (
                        <XCircle className="size-2.5" />
                      ) : (
                        <span className="font-semibold text-[9px]">{i + 1}</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "text-xs font-medium whitespace-nowrap",
                        phase.active && !phase.done ? "text-primary font-semibold" :
                        phase.done ? "text-foreground" :
                        phase.error ? "text-destructive" :
                        "text-muted-foreground/50",
                      )}
                    >
                      {phase.label}
                    </span>
                  </div>
                  {i < phases.length - 1 && (
                    <ChevronRight className="size-3 text-border shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Browser capture (full width, prominent) ── */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Browser chrome bar */}
            <div className="px-4 py-2.5 border-b border-border bg-muted/30 flex items-center gap-3">
              <div className="flex gap-1.5 shrink-0">
                <div className="size-2.5 rounded-full bg-muted-foreground/25" />
                <div className="size-2.5 rounded-full bg-muted-foreground/25" />
                <div className="size-2.5 rounded-full bg-muted-foreground/25" />
              </div>
              <div className="flex-1 bg-background rounded-md px-3 py-1 text-xs font-mono text-muted-foreground flex items-center gap-1.5 border border-border truncate shadow-2xs">
                <Lock className="size-3 text-primary shrink-0" />
                <span className="select-all truncate">{currentUrl ?? "Waiting for agent…"}</span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Monitor className="size-3.5 text-muted-foreground/50" />
                <span className="text-[10px] text-muted-foreground/50 font-mono">Live</span>
              </div>
            </div>

            {/* Screenshot area — fixed 16:9 aspect ratio */}
            <div className="aspect-video bg-muted/10 relative flex items-center justify-center">
              {screenshot ? (
                <Image
                  src={screenshot}
                  alt="Latest browser capture"
                  fill
                  unoptimized
                  className="object-contain cursor-zoom-in"
                  priority
                  onClick={() => setPreviewScreenshot(screenshot)}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <LoaderCircle className="size-7 animate-spin text-primary/60" />
                  <p className="text-sm text-muted-foreground/70">
                    Waiting for browser capture…
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Two-column: Agent Log + Control Panel ── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">

            {/* Agent Action Log */}
            <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              <div className="px-5 py-3.5 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Terminal className="size-3.5 text-primary" />
                  Agent Action Log
                </h2>
                <div className="flex items-center gap-2">
                  {!isTerminal && isConnected && (
                    <span className="flex items-center gap-1.5 text-[10px] text-primary font-medium">
                      <span className="size-1.5 rounded-full bg-primary animate-pulse" />
                      Live
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground/60 font-mono">
                    {events.length} events
                  </span>
                </div>
              </div>

              {/* Fixed-height scroll area */}
              <div
                className="h-[480px] overflow-y-auto p-4 flex flex-col gap-2.5"
                style={{ scrollbarWidth: "thin" }}
              >
                {error && (
                  <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 font-mono">
                    {error}
                  </div>
                )}

                {/* Skeleton while waiting */}
                {events.length === 0 && (
                  <div className="flex flex-col gap-2.5">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="h-16 bg-muted/40 rounded-lg animate-pulse"
                        style={{ animationDelay: `${i * 120}ms` }}
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
                {/* scroll anchor */}
                <div ref={logBottomRef} />
              </div>
            </div>

            {/* Control Panel */}
            <div className="flex flex-col gap-4">

              {/* Run Goal card */}
              <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Run Goal
                </h4>
                <p className="text-sm text-foreground leading-relaxed">
                  {summary?.goal ?? (
                    <span className="text-muted-foreground/50">Loading…</span>
                  )}
                </p>
                {status === "DONE" && (
                  <Link
                    href={`/runs/${encodeURIComponent(runId ?? "")}/result`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-full")}
                  >
                    View Result Report →
                  </Link>
                )}
              </div>

              {/* HITL Panel — only shown when agent paused */}
              {hasHITL && (
                <div className="bg-card border border-destructive/30 rounded-xl overflow-hidden">
                  <div className="bg-destructive/8 border-b border-destructive/20 px-5 py-3.5 flex items-center gap-2.5">
                    <AlertTriangle className="size-4 text-destructive shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Approval Required</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        The agent detected a variance and paused.
                      </p>
                    </div>
                  </div>

                  <div className="p-5 flex flex-col gap-4">
                    {/* Discrepancies */}
                    {hitlDiscrepancies.length > 0 ? (
                      <div className="rounded-lg border border-border overflow-hidden">
                        <div className="bg-muted/30 px-3 py-2 border-b border-border">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Discrepancies detected
                          </span>
                        </div>
                        <div className="divide-y divide-border">
                          {hitlDiscrepancies.map((d, i) => (
                            <div key={i} className="px-3 py-2.5 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground capitalize">
                                  {d.kind}
                                </p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  Expected: {String(d.expected)}
                                </p>
                                <p className="text-[11px] text-muted-foreground">
                                  Found: {String(d.actual)}
                                </p>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <span className="font-mono text-sm font-bold text-destructive">
                                  {d.variancePct > 0 ? "+" : ""}{d.variancePct}%
                                </span>
                                <Badge
                                  className={cn(
                                    "text-[9px] font-bold px-1.5 py-0 h-4 border-transparent uppercase tracking-wider",
                                    d.severity === "high"
                                      ? "bg-destructive/10 text-destructive hover:bg-destructive/15"
                                      : "bg-primary/10 text-primary hover:bg-primary/15"
                                  )}
                                >
                                  {d.severity}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {hitlDetail}
                      </p>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-col gap-2">
                      <Button
                        className="w-full gap-2"
                        size="sm"
                        disabled={isResolving}
                        onClick={handleApprove}
                      >
                        {isResolving ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="size-3.5" />
                        )}
                        Approve & Continue
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full gap-2"
                        size="sm"
                        disabled={isResolving}
                        onClick={() => setOverrideOpen((o) => !o)}
                      >
                        <Edit3 className="size-3.5" />
                        Override Target
                      </Button>

                      {overrideOpen && (
                        <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-150">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={overrideTarget}
                            onChange={(e) => setOverrideTarget(e.target.value)}
                            placeholder="New target $"
                            className="flex-1 px-3 py-2 border border-border rounded-lg bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
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
                        className="w-full gap-2 text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/5"
                        size="sm"
                        disabled={isResolving}
                        onClick={handleAbort}
                      >
                        <XCircle className="size-3.5" />
                        Abort Task
                      </Button>
                    </div>

                    {/* Custom instruction */}
                    <div className="border-t border-border pt-4 flex flex-col gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Or give a custom instruction
                      </span>
                      <textarea
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        rows={3}
                        placeholder="e.g. Change the quantity to 3 units and continue."
                        className="w-full resize-none px-3 py-2.5 border border-border rounded-lg bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                      />
                      <Button
                        size="sm"
                        className="w-full gap-2"
                        disabled={isResolving || !instruction.trim()}
                        onClick={handleCustomInstruction}
                      >
                        {isResolving ? (
                          <LoaderCircle className="size-3.5 animate-spin" />
                        ) : (
                          <Send className="size-3.5" />
                        )}
                        Send Instruction
                      </Button>
                    </div>

                    {resolveError && (
                      <p
                        role="alert"
                        className="text-xs text-destructive bg-destructive/10 border border-destructive/25 rounded-lg px-3 py-2"
                      >
                        {resolveError}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Post-approval confirmation */}
              {hitlResolved && (
                <div className="bg-primary/8 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
                  <CheckCircle2 className="size-4 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-primary">Approved</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Agent resuming…
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Screenshot preview overlay */}
      {previewScreenshot && (
        <div
          ref={previewOverlayRef}
          onClick={(event) => {
            if (event.target === previewOverlayRef.current) {
              setPreviewScreenshot(null);
            }
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-6 backdrop-blur-sm"
        >
          <div className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewScreenshot(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-background/90 px-3 py-1.5 text-xs font-semibold text-foreground shadow hover:bg-background transition-colors"
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
