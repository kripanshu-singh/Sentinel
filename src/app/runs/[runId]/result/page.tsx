"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { LineItem, RunSummary } from "@/types";
import {
  Bell,
  HelpCircle,
  ChevronRight,
  Download,
  CheckCircle2,
  AlertTriangle,
  CheckCheck,
} from "lucide-react";

const STATUS_CONFIG = {
  ok: {
    label: "OK",
    className: "bg-primary/10 text-primary",
    icon: CheckCircle2,
  },
  flagged: {
    label: "Flagged",
    className: "bg-destructive/10 text-destructive",
    icon: AlertTriangle,
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-primary/10 text-primary border border-primary/30",
    icon: CheckCheck,
  },
} as const;

function exportCsv(runId: string, items: LineItem[]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = "SKU,Description,Qty,Unit Price,Discount,Line Total,Status";
  const rows = items.map((item) =>
    [
      item.sku,
      item.description,
      item.quantity,
      item.unitPrice.toFixed(2),
      item.discounts.toFixed(2),
      item.lineTotal.toFixed(2),
      item.status,
    ]
      .map(escape)
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sentinel-report-${runId}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const [runId, setRunId] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setRunId(p.runId));
  }, [params]);

  const { data: summary, isLoading } = useQuery({
    queryKey: ["run", runId],
    queryFn: async (): Promise<RunSummary> => {
      const res = await fetch(`/api/runs/${encodeURIComponent(runId ?? "")}`);
      if (!res.ok) throw new Error("Failed to fetch run report");
      return res.json();
    },
    enabled: !!runId,
  });

  const report = summary?.report;
  const lineItems = report?.items ?? [];
  const discrepancies = report?.discrepancies ?? [];
  const channels = report?.channels ?? [];
  const grandTotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);

  return (
    <SidebarInset>
      {/* Top Bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Agent Runs</span>
            <ChevronRight className="size-4" />
            <span className="text-foreground font-semibold">Run ID: {runId ?? "…"}</span>
            <ChevronRight className="size-4" />
            <span className="text-foreground font-semibold">Result Report</span>
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

      <main className="flex-1 p-6 flex flex-col gap-6 max-w-5xl mx-auto w-full">
        {isLoading && (
          <div className="flex flex-col gap-6">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        )}

        {!isLoading && !report && (
          <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-semibold text-foreground">No report yet</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              The reconciliation report is generated when the run reaches the
              review screen. If the run just completed, refresh shortly.
            </p>
            <Link href={`/runs/${encodeURIComponent(runId ?? "")}`} className="text-primary text-xs hover:underline mt-2">
              ← Back to live run
            </Link>
          </div>
        )}

        {report && (
          <>
            {/* Summary card */}
            <div className="bg-card border border-border rounded-xl p-6 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle2 className="size-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="font-heading text-lg font-semibold text-foreground">
                        Run {report.runId} — Complete
                      </h1>
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                        {summary?.status ?? "DONE"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Generated {new Date(report.generatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <Button
                  className="gap-2"
                  size="sm"
                  onClick={() => exportCsv(report.runId, lineItems)}
                >
                  <Download className="size-4" />
                  Export CSV
                </Button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
                {report.summary}
              </p>
            </div>

            {/* Discrepancies */}
            {discrepancies.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">
                    Discrepancies
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Rules that deviated from the configured business targets.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        {["Kind", "Expected", "Actual", "Variance", "Severity"].map((col) => (
                          <th
                            key={col}
                            className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {discrepancies.map((d, i) => (
                        <tr key={i} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 font-mono text-xs text-foreground uppercase">
                            {d.kind}
                          </td>
                          <td className="px-4 py-3 font-mono">{String(d.expected)}</td>
                          <td className="px-4 py-3 font-mono text-destructive">
                            {String(d.actual)}
                          </td>
                          <td className="px-4 py-3 font-mono">
                            {d.variancePct > 0 ? "+" : ""}
                            {d.variancePct}%
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
                                d.severity === "high"
                                  ? "bg-destructive/10 text-destructive"
                                  : "bg-primary/10 text-primary"
                              )}
                            >
                              {d.severity}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Reconciliation table */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground">
                  Reconciliation Table
                </h2>
                <span className="text-xs text-muted-foreground font-mono">
                  Grand Total:{" "}
                  <span className="font-semibold text-foreground">
                    ${grandTotal.toFixed(2)}
                  </span>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {["SKU", "Description", "Qty", "Unit Price", "Discount", "Line Total", "Status"].map(
                        (col) => (
                          <th
                            key={col}
                            className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                          >
                            {col}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-6 text-center text-xs text-muted-foreground">
                          No line items were extracted from the checkout review.
                        </td>
                      </tr>
                    )}
                    {lineItems.map((item) => {
                      const cfg = STATUS_CONFIG[item.status];
                      const StatusIcon = cfg.icon;
                      return (
                        <tr
                          key={item.sku}
                          className={cn(
                            "border-b border-border last:border-0 transition-colors",
                            item.status === "flagged" && "bg-destructive/[0.03]",
                            item.status === "confirmed" && "bg-primary/[0.02]"
                          )}
                        >
                          <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                            {item.sku}
                          </td>
                          <td className="px-4 py-3 text-foreground max-w-[220px] truncate">
                            {item.description}
                          </td>
                          <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
                          <td className="px-4 py-3 text-right font-mono">
                            ${item.unitPrice.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                            {item.discounts !== 0
                              ? `$${item.discounts.toFixed(2)}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-semibold">
                            ${item.lineTotal.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
                                cfg.className
                              )}
                            >
                              <StatusIcon className="size-3" />
                              {cfg.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Multi-channel comparison */}
            {channels.length > 0 && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">
                    Channel Comparison
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Per-store snapshots extracted during the audit.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        {["Channel", "Price / unit", "Discount", "Shipping", "Computed margin"].map(
                          (col) => (
                            <th
                              key={col}
                              className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap"
                            >
                              {col}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {channels.map((ch) => (
                        <tr key={ch.channel} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                            {ch.channel}
                          </td>
                          <td className="px-4 py-3 font-mono">${ch.price.toFixed(2)}</td>
                          <td className="px-4 py-3 font-mono">${ch.discount.toFixed(2)}</td>
                          <td className="px-4 py-3 font-mono">${ch.shipping.toFixed(2)}</td>
                          <td className="px-4 py-3 font-mono">{ch.computedMargin.toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </SidebarInset>
  );
}
