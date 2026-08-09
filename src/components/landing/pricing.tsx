"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Plan {
  id: string;
  name: string;
  cadence: { monthly: string; annual: string };
  descriptor: string;
  blurb: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    cadence: { monthly: "$0", annual: "$0" },
    descriptor: "free — no card",
    blurb: "For individual buyers exploring agentic procurement.",
    features: [
      "25 automated runs / month",
      "HITL approval modal",
      "Amazon & eBay storefronts",
      "CSV invoice export",
      "Community support",
    ],
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Pro procurement",
    cadence: { monthly: "$149", annual: "$119" },
    descriptor: "+ saved per run",
    blurb: "For procurement managers auditing vendor contract pricing.",
    features: [
      "Unlimited guarded runs",
      "Multi-store price audit engine",
      "Custom tolerance thresholds",
      "Coupon recovery & fallback policies",
      "Real-time SSE event stream",
      "Priority worker queue",
    ],
    cta: "Launch pro fleet",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise fleet",
    cadence: { monthly: "Custom", annual: "Custom" },
    descriptor: "tailored SLA",
    blurb: "For procurement teams with custom B2B portals and ERP hooks.",
    features: [
      "Dedicated browser fleet",
      "ERP & SAP webhooks",
      "SSO + audit-log compliance",
      "Custom DOM extractors",
      "Dedicated account manager",
      "Custom SLA & uptime",
    ],
    cta: "Contact sales",
  },
];

export function Pricing() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-10 flex flex-col items-center gap-6">
        <div className="inline-flex items-center rounded-full border border-border/70 bg-foreground/[0.03] p-1">
          <button
            onClick={() => setAnnual(false)}
            className={cn(
              "rounded-full px-4 py-1.5 font-mono text-xs transition-colors",
              !annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-xs transition-colors",
              annual ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            Annual
            <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", annual ? "bg-primary-foreground/20 text-primary-foreground" : "bg-positive/15 text-positive")}>
              −20%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {PLANS.map((plan, i) => {
          const price = annual ? plan.cadence.annual : plan.cadence.monthly;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                "relative flex flex-col rounded-2xl border p-6",
                plan.popular
                  ? "border-primary/50 bg-primary/[0.04] shadow-[0_0_0_1px] shadow-primary/20"
                  : "border-border/70 bg-foreground/[0.02]"
              )}
            >
              {plan.popular && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-primary-foreground">
                  Most popular
                </span>
              )}

              <div className="mb-4">
                <h3 className="font-heading text-lg font-semibold tracking-tight text-foreground">{plan.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
              </div>

              <div className="mb-6 flex items-baseline gap-2">
                <span className="font-mono text-4xl font-bold tracking-tight text-foreground">{price}</span>
                <span className="font-mono text-xs text-muted-foreground">/ {plan.descriptor}</span>
              </div>

              <ul className="mb-8 flex flex-col gap-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm text-foreground/90">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
                      <Check className="size-2.5 text-primary" aria-hidden />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href="/app"
                className={cn(
                  "mt-auto inline-flex h-10 items-center justify-center rounded-lg text-sm font-semibold transition-colors",
                  plan.popular
                    ? "bg-primary text-primary-foreground hover:opacity-90"
                    : "border border-border/80 text-foreground hover:bg-foreground/[0.04]"
                )}
              >
                {plan.cta}
              </Link>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-6 text-center font-mono text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <Minus className="size-3 text-primary" aria-hidden />
          Every plan ships with the human-in-the-loop release gate. No exceptions.
        </span>
      </p>
    </div>
  );
}