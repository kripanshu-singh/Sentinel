"use client";

import Link from "next/link";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { ReconciliationLineItem, ChannelSnapshot } from "@/types";
import {
  Bell,
  HelpCircle,
  ChevronRight,
  Download,
  CheckCircle2,
  AlertTriangle,
  CheckCheck,
} from "lucide-react";

const MOCK_LINE_ITEMS: ReconciliationLineItem[] = [
  {
    sku: "ALM-BAR-1L",
    description: "Premium Barista Almond Milk 1L",
    qty: 24,
    unitPrice: 4.80,
    discount: 0,
    lineTotal: 115.20,
    status: "confirmed",
  },
  {
    sku: "OAT-MIL-1L",
    description: "Barista Oat Milk 1L",
    qty: 10,
    unitPrice: 3.60,
    discount: 0.36,
    lineTotal: 32.40,
    status: "ok",
  },
  {
    sku: "SHP-STD-01",
    description: "Standard Shipping (2-3 days)",
    qty: 1,
    unitPrice: 8.99,
    discount: 0,
    lineTotal: 8.99,
    status: "ok",
  },
  {
    sku: "DSC-SUMMER",
    description: "SUMMER20 coupon — code invalid, fell back to wholesale tier",
    qty: 1,
    unitPrice: 0,
    discount: -12.00,
    lineTotal: -12.00,
    status: "flagged",
  },
];

const MOCK_CHANNELS: ChannelSnapshot[] = [
  {
    channel: "Primary Vendor (VN-821)",
    price: 4.80,
    discount: 0,
    shipping: 8.99,
    margin: 14.2,
    variancePct: 20,
    aboveThreshold: true,
  },
  {
    channel: "Secondary Vendor (VN-445)",
    price: 4.10,
    discount: 0.20,
    shipping: 6.50,
    margin: 18.6,
    variancePct: 2.5,
    aboveThreshold: false,
  },
];

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
};

function exportCsv(items: ReconciliationLineItem[]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = "SKU,Description,Qty,Unit Price,Discount,Line Total,Status";
  const rows = items.map((item) =>
    [
      item.sku,
      item.description,
      item.qty,
      item.unitPrice.toFixed(2),
      item.discount.toFixed(2),
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
  a.download = "sentinel-report-PRQ-8992.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultPage() {
  const lineItems = MOCK_LINE_ITEMS;
  const channels = MOCK_CHANNELS;
  const grandTotal = lineItems.reduce((sum, i) => sum + i.lineTotal, 0);

  return (
    <SidebarInset>
      {/* Top Bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/runs" className="hover:text-primary transition-colors">Agent Runs</Link>
            <ChevronRight className="size-4" />
            <Link href="/runs/1" className="hover:text-primary transition-colors">PRQ-8992</Link>
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
                    Run PRQ-8992 — Complete
                  </h1>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                    DONE
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Generated 6 Aug 2026, 10:44:02 UTC
                </p>
              </div>
            </div>
            <Button
              className="gap-2"
              size="sm"
              onClick={() => exportCsv(lineItems)}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed border-t border-border pt-3">
            The agent successfully navigated the vendor portal and built a cart
            with 24 units of Barista Almond Milk and 10 units of Oat Milk. A
            price variance of +20% on the Almond Milk SKU was detected and
            escalated for human review — the operator approved and continued.
            Discount code SUMMER20 was invalid; the agent fell back to the
            default wholesale tier. The final draft invoice is ready for review
            below. <strong>No order was placed.</strong>
          </p>
        </div>

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
                      <td className="px-4 py-3 text-right font-mono">{item.qty}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        ${item.unitPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {item.discount !== 0
                          ? `$${item.discount.toFixed(2)}`
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
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground">
              Multi-Channel Comparison
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rows above the variance threshold are flagged.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  {["Channel", "Price / unit", "Discount", "Shipping", "Margin", "Variance", ""].map(
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
                  <tr
                    key={ch.channel}
                    className={cn(
                      "border-b border-border last:border-0",
                      ch.aboveThreshold && "bg-destructive/[0.03]"
                    )}
                  >
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                      {ch.aboveThreshold && (
                        <span className="inline-block w-1 h-4 bg-destructive rounded-full mr-2 align-middle" />
                      )}
                      {ch.channel}
                    </td>
                    <td className="px-4 py-3 font-mono">${ch.price.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono">${ch.discount.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono">${ch.shipping.toFixed(2)}</td>
                    <td className="px-4 py-3 font-mono">{ch.margin.toFixed(1)}%</td>
                    <td className="px-4 py-3 font-mono">
                      <span
                        className={cn(
                          "font-semibold",
                          ch.aboveThreshold
                            ? "text-destructive"
                            : "text-primary"
                        )}
                      >
                        +{ch.variancePct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ch.aboveThreshold ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive">
                          <AlertTriangle className="size-3" />
                          Above threshold
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/10 text-primary">
                          <CheckCircle2 className="size-3" />
                          Auto-passed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
}
