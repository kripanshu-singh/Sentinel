"use client";

import { motion } from "motion/react";
import { GlowCta } from "@/components/landing/glow-cta";
import { WatchButton } from "@/components/landing/watch-button";
import { SplitHeadline } from "@/components/landing/split-headline";

const SUB_COPY =
  "Sentinel is a guardrailed agent for B2B buying. Give it a goal in plain English; it navigates vendor storefronts, builds the cart, validates every unit price and coupon against your contract — then pauses for your sign-off before anything high-stakes moves.";

const EASE = [0.16, 1, 0.3, 1] as const;

export function HeroContent() {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <h1 className="font-heading text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
        <SplitHeadline
          text="Procurement that runs itself — with a human at every gate."
          accentWords={["human", "every", "gate."]}
        />
      </h1>

      <motion.p
        initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: 1.05, duration: 0.8, ease: EASE }}
        className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground"
      >
        {SUB_COPY}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 26, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ delay: 1.5, duration: 0.8, ease: EASE }}
        className="mt-9 flex flex-wrap items-center justify-center gap-3"
      >
        <GlowCta href="/app" label="Launch the console" />
        <WatchButton />
      </motion.div>
    </div>
  );
}