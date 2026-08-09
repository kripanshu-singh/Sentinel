"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { CtaBloom } from "@/components/landing/cta-bloom";
import { WatchButton } from "@/components/landing/watch-button";

const EASE = [0.16, 1, 0.3, 1] as const;

export function FinalCta() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 48, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.9, ease: EASE }}
      className="relative overflow-hidden rounded-3xl border border-[#6bd8cb]/20 bg-[#15191b] px-6 py-16 text-center md:px-16 md:py-24"
    >
      {/* Obsidian bloom canvas */}
      <CtaBloom />

      {/* Content — z-10 so it sits above the canvas */}
      <div className="relative z-10">
        {/* Icon badge with breathing ring */}
        <motion.span
          initial={{ opacity: 0, scale: 0.6 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative mx-auto mb-8 flex size-16 items-center justify-center"
        >
          <motion.span
            aria-hidden
            className="absolute inset-0 rounded-2xl border border-[#6bd8cb]/40"
            animate={{
              scale: [1, 1.32, 1],
              opacity: [0.55, 0, 0.55],
            }}
            transition={{
              duration: 2.8,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />
          <span className="relative flex size-16 items-center justify-center rounded-2xl border border-[#6bd8cb]/25 bg-[#6bd8cb]/10">
            <ShieldCheck className="size-8 text-[#6bd8cb]" aria-hidden />
          </span>
        </motion.span>

        <motion.h2
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, delay: 0.12, ease: EASE }}
          className="mx-auto max-w-2xl font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl"
        >
          Ready to put a guard on{" "}
          <span className="text-[#6bd8cb]">your next order run?</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, delay: 0.26, ease: EASE }}
          className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/60"
        >
          Set a goal, pin a target price, and let Sentinel navigate while you keep the
          final say. First run is free.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, delay: 0.4, ease: EASE }}
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
        >
          <Link
            href="/app"
            id="final-cta-launch"
            className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-lg bg-linear-to-b from-[#6bd8cb] to-[#47bfb1] px-8 text-sm font-semibold text-[#00201d] shadow-lg shadow-[#6bd8cb]/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#6bd8cb]/35"
          >
            Launch the console
            <ArrowRight
              className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
            {/* Shine sweep */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 -translate-x-full skew-x-[-20deg] bg-linear-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
            />
          </Link>

          <WatchButton label="Watch it run" />
        </motion.div>

        {/* Subtle trust signal */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-white/30"
        >
          / zero-unapproved spend · 100% human-in-the-loop /
        </motion.p>
      </div>
    </motion.div>
  );
}