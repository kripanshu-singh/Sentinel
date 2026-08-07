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
  Camera,
  Send,
  ChevronRight,
} from "lucide-react";

const EVENT_LABELS: Record<string, string> = {
  NAVIGATE: "NAVIGATE",
  SEARCH: "SEARCH",
  EXTRACT: "EXTRACT",
  CHECK: "CHECK",
  HITL: "HITL",
  FORM_FILL: "FORM_FILL",
  VALIDATE: "VALIDATE",
  RECOVER: "RECOVER",
  DRAFT: "DRAFT",
};

type StreamTone = "done" | "live" | "error";

function streamTone(status: AgentEvent["status"]): StreamTone {
  if (status === "error") return "error";
  if (status === "pending") return "live";
  return "done";
}

function AgentStreamRow({
  event,
  showSpinner,
  isLast,
  onOpenScreenshot,
}: {
  event: AgentEvent;
  showSpinner: boolean;
  isLast: boolean;
  onOpenScreenshot?: () => void;
}) {
  const tone = streamTone(event.status);
  const label = EVENT_LABELS[event.type] ?? event.type;
  const screenshot =
    typeof event.evidence?.screenshot === "string"
      ? event.evidence.screenshot
      : undefined;

  return (
    <div className="relative flex gap-3 pb-3 last:pb-0">
      {/* node + connecting rail */}
      <div className="relative w-4 shrink-0">
        <span
          aria-hidden
          className={
            tone === "error"
              ? "absolute left-0 mt-1 size-2 rounded-full bg-destructive"
              : tone === "live"
                ? "absolute left-0 mt-1 size-2 rounded-full bg-primary/45 animate-pulse"
                : "absolute left-0 mt-1 size-2 rounded-full bg-primary"
          }
        >
          {tone === "live" && showSpinner && (
            <span className="absolute -inset-0.5 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
          )}
        </span>
        {!isLast && (
          <span aria-hidden className="absolute left-[3px] top-5 bottom-0 w-px bg-border/60" />
        )}
      </div>

      {/* content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-3">
          <p
            className={cn(
              "text-[13px] font-medium leading-snug font-sans",
              tone === "error" ? "text-destructive" : "text-foreground",
            )}
          >
            {event.title}
          </p>
          <span
            className={cn(
              "shrink-0 font-mono text-[10px] tracking-wider",
              tone === "error"
                ? "text-destructive"
                : tone === "live"
                  ? "text-primary"
                  : "text-muted-foreground",
            )}
          >
            {label}
          </span>
        </div>
        <p className="mt-0.5 text-xs font-sans leading-relaxed text-muted-foreground">
          {event.detail}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {event.timestamp}
          </span>
          {screenshot && (
            <button
              type="button"
              onClick={onOpenScreenshot}
              className="group inline-flex items-center gap-1.5 font-mono text-[10px] text-primary transition-colors hover:text-primary/80"
            >
              <Camera className="size-3.5" />
              View capture
            </button>
          )}
        </div>
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
      // Poll aggressively while waiting for human input so the approval
      // panel appears without needing a page refresh.
      if (status === "HITL_PENDING") return 1000;
      return 3000;
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
    !!status &&
    !hitlResolved &&
    !isTerminal &&
    Boolean(
      (hitlEvent && hitlEvent.status === "pending") ||
      (approvalRequest && !approvalRequest.resolution) ||
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
    <SidebarInset className="h-dvh overflow-hidden flex flex-col">
      <SentinelNavbar
        breadcrumbs={[
          // { label: "Runs", href: "/" },
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

      <main className="flex-1 flex flex-col gap-5 p-6 overflow-hidden min-h-0">
        {/* Terminal-state banner */}
        {status === "FAILED" && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 flex items-start gap-3 shrink-0">
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
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-3 shrink-0">
            <CheckCircle2 className="size-5 text-primary shrink-0" />
            <p className="text-sm font-semibold text-primary">Run complete</p>
          </div>
        )}
        {status === "ABORTED" && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 flex items-center gap-3 shrink-0">
            <XCircle className="size-5 text-destructive shrink-0" />
            <p className="text-sm font-semibold text-destructive">
              Run aborted
            </p>
          </div>
        )}

        {/* Progress Stepper */}
        <div className="bg-card border border-border rounded-xl p-3 px-6 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <span>Workflow Progress</span>
            <span className="text-[10px] text-muted-foreground/30">•</span>
            <span className="text-foreground normal-case font-medium">
              {status === "DONE" && "Completed"}
              {status === "FAILED" && "Failed"}
              {status === "ABORTED" && "Aborted"}
              {status !== "DONE" && status !== "FAILED" && status !== "ABORTED" && (isConnected ? "Running" : "Connecting…")}
            </span>
          </div>
          <div className="flex items-center gap-3 md:gap-5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {phases.map((phase, i) => {
              return (
                <div key={phase.id} className="flex items-center gap-2 shrink-0">
                  <div
                    className={cn(
                      "size-5 rounded-full flex items-center justify-center text-[10px] relative transition-all",
                      phase.done && "bg-primary text-primary-foreground",
                      phase.active &&
                        !phase.done &&
                        "border border-primary bg-primary/10 text-primary font-bold shadow-[0_0_8px_rgba(0,104,95,0.2)] animate-pulse",
                      phase.error && "bg-destructive/10 text-destructive border border-destructive",
                      !phase.done &&
                        !phase.active &&
                        !phase.error &&
                        "border border-border bg-background text-muted-foreground/60",
                    )}
                  >
                    {phase.done ? (
                      <CheckCheck className="size-3" />
                    ) : phase.error ? (
                      <XCircle className="size-3" />
                    ) : (
                      <span className="font-semibold">{i + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-medium tracking-tight",
                      phase.active && !phase.done
                        ? "text-primary font-semibold"
                        : phase.done
                          ? "text-foreground"
                          : phase.error
                            ? "text-destructive"
                            : "text-muted-foreground/60",
                    )}
                  >
                    {phase.label}
                  </span>
                  {i < phases.length - 1 && (
                    <ChevronRight className="size-3 text-muted-foreground/30 ml-1.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Three-pane grid layout — smooth, distanced cards */}
        <div className="flex-1 grid grid-cols-12 gap-5 min-h-0">
          {/* Left pane: Agent stream */}
          <div className="col-span-3 bg-card border border-border rounded-xl overflow-hidden flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-border bg-muted/40 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Terminal className="size-4 text-primary" />
                Run log
              </h2>
              <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5">
                {isConnected && (
                  <span className="inline-block size-1.5 rounded-full bg-primary animate-pulse" />
                )}
                {events.length} event{events.length === 1 ? "" : "s"}
              </span>
            </div>
            <div
              className="flex-1 overflow-y-auto px-3 py-3 min-h-0"
              style={{ scrollbarWidth: "thin" }}
            >
              {error && (
                <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded p-2 mb-2 font-mono">
                  {error}
                </div>
              )}
              {events.length === 0 && (
                <div className="flex flex-col gap-2 mt-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 bg-muted/40 rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              )}
              {events.map((event, i) => (
                <AgentStreamRow
                  key={event.id}
                  event={event}
                  isLast={i === events.length - 1}
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

          {/* Center pane: live browser capture */}
          <div className="col-span-6 bg-card border border-border rounded-xl flex flex-col overflow-hidden min-h-0">
            {/* Browser chrome */}
            <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center gap-3 shrink-0">
              <div className="flex gap-1.5 shrink-0">
                <div className="size-2.5 rounded-full bg-destructive/70 hover:bg-destructive transition-colors cursor-pointer" />
                <div className="size-2.5 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground transition-colors cursor-pointer" />
                <div className="size-2.5 rounded-full bg-primary/70 hover:bg-primary transition-colors cursor-pointer" />
              </div>
              <div className="flex-1 bg-background rounded-lg px-3 py-1 text-xs font-mono text-muted-foreground flex items-center gap-1.5 border border-border truncate max-w-lg shadow-2xs">
                <Lock className="size-3 text-primary shrink-0" />
                <span className="select-all truncate">{currentUrl ?? "https://www.saucedemo.com/"}</span>
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
                  priority
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <LoaderCircle className="size-6 animate-spin text-primary" />
                  <p className="text-xs font-mono">
                    Waiting for browser capture…
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right pane: HITL control */}
          <div className="col-span-3 flex flex-col gap-4 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
            {/* HITL Control Panel */}
            {hasHITL && (
              <div className="bg-card border-2 border-destructive/30 rounded-xl overflow-hidden shadow-lg shrink-0">
                <div className="bg-destructive/10 px-4 py-3 flex items-start gap-3 border-b border-destructive/20">
                  <AlertTriangle className="size-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      Variance Alert
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      The agent paused due to discrepancy detection.
                    </p>
                  </div>
                </div>
                <div className="p-4 flex flex-col gap-4">
                  {/* Discrepancies */}
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
                            <Badge
                              className={cn(
                                "text-[9px] font-bold px-1.5 py-0 h-4 border-transparent uppercase tracking-wider shrink-0",
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
                  ) : (
                    <p className="text-xs text-muted-foreground leading-relaxed">
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
                        <LoaderCircle className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="size-3.5" />
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
                      <Edit3 className="size-3.5" />
                      Override Target
                    </Button>

                    {overrideOpen && (
                      <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
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
                      className="w-full gap-2 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
                      size="sm"
                      disabled={isResolving}
                      onClick={handleAbort}
                    >
                      <XCircle className="size-3.5" />
                      Abort Task
                    </Button>

                    <div className="flex flex-col gap-2 border-t border-border pt-3 mt-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Or type your own instruction
                      </span>
                      <textarea
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        rows={3}
                        placeholder="e.g. Change the quantity to 3 units and continue."
                        className="w-full resize-none px-3 py-2 border border-border rounded-lg bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
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
                        className="text-xs text-destructive bg-destructive/10 border border-destructive/25 rounded px-2.5 py-1 mt-1 font-sans"
                      >
                        {resolveError}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {hitlResolved && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center gap-3 shrink-0">
                <CheckCircle2 className="size-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-primary">Approved</p>
                  <p className="text-xs text-muted-foreground">
                    Agent resuming checkout…
                  </p>
                </div>
              </div>
            )}

            {/* Run goal details card */}
            <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-2 shrink-0">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Run Goal
              </h4>
              <p className="text-xs text-foreground leading-relaxed font-sans">
                {summary?.goal ?? "…"}
              </p>
            </div>

            {/* View Result link */}
            {status === "DONE" && (
              <Link
                href={`/runs/${encodeURIComponent(runId ?? "")}/result`}
                className={cn(buttonVariants({ variant: "outline" }), "w-full gap-1.5 shrink-0")}
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