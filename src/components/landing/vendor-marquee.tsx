"use client";

import { motion } from "motion/react";

const VENDORS = [
  "Amazon Business",
  "eBay Enterprise",
  "Target B2B",
  "B&H Photo",
  "SauceDemo Portal",
  "Custom Web Store",
  "Distributor STN",
  "Office Supply LP",
];

export function VendorMarquee() {
  const doubled = [...VENDORS, ...VENDORS];
  return (
    <div
      className="relative overflow-hidden py-3 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
    >
      <motion.div
        className="flex w-max gap-12 pr-12"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 30, ease: "linear", repeat: Infinity }}
      >
        {doubled.map((v, i) => (
          <span
            key={`${v}-${i}`}
            className="flex items-center gap-3 font-mono text-sm text-muted-foreground whitespace-nowrap"
          >
            <span className="size-1 rounded-full bg-primary/60" />
            {v}
          </span>
        ))}
      </motion.div>
    </div>
  );
}