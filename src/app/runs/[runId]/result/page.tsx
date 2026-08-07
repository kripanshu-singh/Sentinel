"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from "@/components/ui/table";
import { SentinelNavbar } from "@/components/sentinel-navbar";
import type { LineItem, RunSummary } from "@/types";
import { Download, CheckCircle2, AlertTriangle, CheckCheck } from "lucide-react";

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

const TH_CLASS =
  "text-xs font-semibold uppercase tracking-wider text-muted-foreground";
const NUM_H_CLASS = "text-right";
const NUM_B_CLASS = "text-right font-mono tabular-nums";

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
      .join(","),
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
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const report = query.state.data?.report;
      return status === "DONE" && !report ? 2000 : false;
    },
    refetchOnWindowFocus: true,
  });

  const report = summary?.report;
  const lineItems = report?.items ?? [];
  const discrepancies = report?.discrepancies ?? [];
  const channels = report?.channels ?? [];
  const grandTotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const flaggedCount = lineItems.filter((i) => i.status === "flagged").length;
  const confirmedCount = lineItems.filter((i) => i.status === "confirmed").length;

  // Budget context: the worker surfaces a numeric subtotal ceiling as a "price"
  // discrepancy whose `expected` is the budget. If present, show it against the
  // grand total so the reconciliation reads as "budget vs. actual".
  const budgetDisc = discrepancies.find(
    (d) => d.kind === "price" && typeof d.expected === "number",
  );
  const budget = budgetDisc ? Number(budgetDisc.expected) : undefined;
  const overBudget = budget !== undefined && grandTotal > budget;

  const stats = [
    { label: "Line items", value: lineItems.length },
    { label: "Flagged", value: flaggedCount },
    { label: "Confirmed", value: confirmedCount },
    { label: "Grand total", value: `$${grandTotal.toFixed(2)}` },
  ];

  // Allow command-palette to trigger CSV export remotely
  useEffect(() => {
    const handler = () => {
      if (report) exportCsv(report.runId, lineItems);
    };
    window.addEventListener("sentinel:export-csv", handler as EventListener);
    return () => window.removeEventListener("sentinel:export-csv", handler as EventListener);
  }, [report, lineItems]);

  return (
    <SidebarInset>
      <SentinelNavbar
        breadcrumbs={[
          // { label: "Runs", href: "/" },
          {
            label: runId ? `Run ${runId.slice(0, 8)}…` : "…",
            href: runId ? `/runs/${encodeURIComponent(runId)}` : undefined,
          },
          { label: "Result Report" },
        ]}
        statusBadge={{ label: summary?.status ?? "DONE", variant: "primary" }}
      />

      <main className="flex-1 p-6 flex flex-col gap-6 max-w-5xl mx-auto w-full">
        {isLoading && (
          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-11 rounded-xl" />
                  <div className="flex flex-col gap-1.5">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-3 w-56" />
                  </div>
                </div>
                <Skeleton className="h-9 w-28 rounded-lg" />
              </div>
              <Skeleton className="mt-5 h-4 w-full max-w-3xl" />
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-px overflow-hidden rounded-lg border border-border bg-border">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-card px-4 py-3 flex flex-col gap-1.5">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            </div>
            <Skeleton className="h-72 w-full rounded-xl" />
          </div>
        )}

        {!isLoading && !report && (
          <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center gap-3 text-center">
            <p className="text-sm font-semibold text-foreground">
              No report yet
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              The reconciliation report is generated when the run reaches the
              review screen. If the run just completed, refresh shortly.
            </p>
            <Link
              href={`/runs/${encodeURIComponent(runId ?? "")}`}
              className="text-primary text-xs hover:underline mt-2"
            >
              ← Back to live run
            </Link>
          </div>
        )}

        {report && (
          <>
            {/* Summary hero */}
            <div className="relative overflow-hidden rounded-xl border border-border bg-card" id="tour-result-hero">
              <div className="px-6 py-6 flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
                      <CheckCircle2 className="size-6 text-primary" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h1 className="font-heading text-lg font-semibold text-foreground">
                          Run complete
                        </h1>
                        <Badge variant="secondary">{summary?.status ?? "DONE"}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {report.runId} · Generated{" "}
                        {new Date(report.generatedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    id="tour-result-export"
                    className="gap-2"
                    onClick={() => exportCsv(report.runId, lineItems)}
                  >
                    <Download className="size-4" />
                    Export CSV
                  </Button>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
                  {report.summary}
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-4 rounded-lg border border-border bg-muted/40">
                  {stats.map((s) => (
                    <div
                      key={s.label}
                      className="px-4 py-3 flex flex-col gap-0.5 border-r border-border last:border-0 sm:[&:nth-child(4)]:border-r-0 [&:nth-child(2n)]:border-r-0 sm:[&:nth-child(2n)]:border-r"
                    >
                      <span className="text-xs text-muted-foreground">
                        {s.label}
                      </span>
                      <span className="font-heading text-xl font-semibold text-foreground tabular-nums">
                        {s.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Discrepancies */}
            {discrepancies.length > 0 && (
              <section className="bg-card border border-border rounded-xl overflow-hidden" id="tour-result-discrepancies">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">
                    Discrepancies
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Rules that deviated from the configured business targets.
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={TH_CLASS}>Kind</TableHead>
                      <TableHead className={TH_CLASS}>Expected</TableHead>
                      <TableHead className={TH_CLASS}>Actual</TableHead>
                      <TableHead className={cn(TH_CLASS, NUM_H_CLASS)}>
                        Variance
                      </TableHead>
                      <TableHead className={TH_CLASS}>Severity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {discrepancies.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs text-muted-foreground uppercase">
                          {d.kind}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums">
                          {String(d.expected)}
                        </TableCell>
                        <TableCell className="font-mono tabular-nums text-destructive">
                          {String(d.actual)}
                        </TableCell>
                        <TableCell className={cn(NUM_B_CLASS, "text-destructive")}>
                          {d.variancePct > 0 ? "+" : ""}
                          {d.variancePct}%
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge
                            variant={d.severity === "high" ? "destructive" : "secondary"}
                          >
                            {d.severity}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )}

            {/* Reconciliation table */}
            <section className="bg-card border border-border rounded-xl overflow-hidden" id="tour-result-table">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    Reconciliation
                    {budget !== undefined && (
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
                          overBudget
                            ? "bg-destructive/10 text-destructive"
                            : "bg-primary/10 text-primary",
                        )}
                      >
                        Budget ${budget.toFixed(2)}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Line items reconciled against the checkout review.
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground font-mono tabular-nums">
                    Grand total:{" "}
                    <span
                      className={cn(
                        "font-semibold",
                        overBudget ? "text-destructive" : "text-foreground",
                      )}
                    >
                      ${grandTotal.toFixed(2)}
                    </span>
                  </span>
                  {overBudget && budget !== undefined && (
                    <span className="text-[11px] font-semibold text-destructive">
                      {grandTotal.toFixed(2) > budget.toFixed(2)
                        ? `Over budget by $${(grandTotal - budget).toFixed(2)}`
                        : "Within budget"}
                    </span>
                  )}
                </div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className={TH_CLASS}>SKU</TableHead>
                    <TableHead className={TH_CLASS}>Description</TableHead>
                    <TableHead className={cn(TH_CLASS, NUM_H_CLASS)}>Qty</TableHead>
                    <TableHead className={cn(TH_CLASS, NUM_H_CLASS)}>
                      Unit price
                    </TableHead>
                    <TableHead className={cn(TH_CLASS, NUM_H_CLASS)}>
                      Discount
                    </TableHead>
                    <TableHead className={cn(TH_CLASS, NUM_H_CLASS)}>
                      Line total
                    </TableHead>
                    <TableHead className={TH_CLASS}>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lineItems.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-8 text-center text-xs text-muted-foreground"
                      >
                        No line items were extracted from the checkout review.
                      </TableCell>
                    </TableRow>
                  )}
                  {lineItems.map((item) => {
                    const cfg = STATUS_CONFIG[item.status];
                    const StatusIcon = cfg.icon;
                    return (
                      <TableRow
                        key={item.sku}
                        className={cn(
                          item.status === "flagged" && "bg-destructive/[0.03]",
                          item.status === "confirmed" && "bg-primary/[0.02]",
                        )}
                      >
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {item.sku}
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate text-foreground">
                          {item.description}
                        </TableCell>
                        <TableCell className={NUM_B_CLASS}>{item.quantity}</TableCell>
                        <TableCell className={NUM_B_CLASS}>
                          ${item.unitPrice.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            NUM_B_CLASS,
                            item.discounts === 0 && "text-muted-foreground",
                          )}
                        >
                          {item.discounts !== 0
                            ? `$${item.discounts.toFixed(2)}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-semibold">
                          ${item.lineTotal.toFixed(2)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
                              cfg.className,
                            )}
                          >
                            <StatusIcon className="size-3" />
                            {cfg.label}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="text-xs text-muted-foreground">
                      Total
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">
                      ${grandTotal.toFixed(2)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </section>

            {/* Multi-channel comparison */}
            {channels.length > 0 && (
              <section className="bg-card border border-border rounded-xl overflow-hidden" id="tour-result-channels">
                <div className="px-5 py-4 border-b border-border">
                  <h2 className="text-sm font-semibold text-foreground">
                    Channel Comparison
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Per-store snapshots extracted during the audit.
                  </p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={TH_CLASS}>Channel</TableHead>
                      <TableHead className={cn(TH_CLASS, NUM_H_CLASS)}>
                        Price / unit
                      </TableHead>
                      <TableHead className={cn(TH_CLASS, NUM_H_CLASS)}>
                        Discount
                      </TableHead>
                      <TableHead className={cn(TH_CLASS, NUM_H_CLASS)}>
                        Shipping
                      </TableHead>
                      <TableHead className={cn(TH_CLASS, NUM_H_CLASS)}>
                        Computed margin
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {channels.map((ch) => (
                      <TableRow key={ch.channel}>
                        <TableCell className="font-medium text-foreground whitespace-nowrap">
                          {ch.channel}
                        </TableCell>
                        <TableCell className={NUM_B_CLASS}>
                          ${ch.price.toFixed(2)}
                        </TableCell>
                        <TableCell className={NUM_B_CLASS}>
                          ${ch.discount.toFixed(2)}
                        </TableCell>
                        <TableCell className={NUM_B_CLASS}>
                          ${ch.shipping.toFixed(2)}
                        </TableCell>
                        <TableCell className={NUM_B_CLASS}>
                          {ch.computedMargin.toFixed(1)}%
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </section>
            )}
          </>
        )}
      </main>
    </SidebarInset>
  );
}