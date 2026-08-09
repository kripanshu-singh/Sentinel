"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Plus } from "lucide-react";

interface Item {
  q: string;
  a: string;
}

const ITEMS: Item[] = [
  {
    q: "Does Sentinel actually spend money or place live orders?",
    a: "No. Sentinel is engineered with a hard stop: it navigates storefronts, builds carts, applies promo codes, and fills shipping forms — but it always parks at the review screen before payment. A human performs the final purchase decision.",
  },
  {
    q: "How is the price-variance guardrail triggered?",
    a: "You set a target unit price and a tolerance band (e.g. 10%). When a live storefront price exceeds that band, the run pauses and surfaces an approval dialog with the contract value, found value, and drift — and waits.",
  },
  {
    q: "What happens when a discount code fails?",
    a: "Sentinel reads the storefront's error message, logs the failure to the event stream, and applies your configured fallback policy — like the contractual wholesale tier or a hold for operator decision — instead of crashing or silently overpaying.",
  },
  {
    q: "Can it audit the same product across different vendors?",
    a: "Yes. The multi-channel audit engine compares unit price, shipping, and discount terms across Amazon Business, eBay Enterprise, B&H, Target B2B, and custom vendor portals in one normalized matrix.",
  },
  {
    q: "What happens to custom enterprise supplier portals?",
    a: "The worker runs on Playwright and LLM reasoning, so it can navigate authenticated vendor portals, custom B2B dashboards, and standard e-commerce stores — with reusable DOM extractors for repeat accounts.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number>(0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-col gap-2.5">
        {ITEMS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={item.q}
              className="overflow-hidden rounded-xl border border-border/70 bg-foreground/[0.02]"
            >
              <button
                onClick={() => setOpen(isOpen ? -1 : i)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-foreground">
                  <span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
                  {item.q}
                </span>
                <motion.span
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border/70"
                >
                  <Plus className="size-3.5 text-muted-foreground" aria-hidden />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <p className="px-5 pb-5 pr-14 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}