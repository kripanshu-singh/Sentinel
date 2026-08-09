"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * GlowCta — Primary CTA button with an animated SVG border trace on mount.
 *
 * The trace is a `<rect>` with `stroke-dasharray` / `stroke-dashoffset`
 * animated from full offset (invisible) to zero (fully drawn) via Motion.
 * After the trace completes, a soft pulsing glow aura continues indefinitely.
 *
 * The button itself is a standard `<Link>` so it works as a server-rendered
 * anchor; the SVG animation is purely decorative and layered on top.
 */
export function GlowCta({
  href,
  label = "Launch the console",
}: {
  href: string;
  label?: string;
}) {
  // border-radius 8px matches rounded-lg
  const r = 8;
  // button is approx h-12 (48px) and intrinsic width ~190px — we use SVG viewBox
  // to make it responsive; the rect fills the viewBox minus stroke width
  const sw = 1.5; // stroke width

  return (
    <div className="relative inline-block">
      {/* SVG trace overlay — pointer-events-none so clicks pass through */}
      <motion.svg
        aria-hidden
        className="pointer-events-none absolute inset-0 size-full overflow-visible"
        viewBox="0 0 1 1"
        preserveAspectRatio="none"
        fill="none"
      >
        <motion.rect
          x={`${sw / 2}px`}
          y={`${sw / 2}px`}
          width={`calc(100% - ${sw}px)`}
          height={`calc(100% - ${sw}px)`}
          rx={r}
          ry={r}
          stroke="#6bd8cb"
          strokeWidth={sw}
          strokeLinecap="round"
          pathLength={1}
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            pathLength: { duration: 1.2, delay: 0.5, ease: [0.4, 0, 0.2, 1] },
            opacity:    { duration: 0.01, delay: 0.5 },
          }}
        />
      </motion.svg>

      {/* Pulsing aura — starts after trace completes */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-lg"
        initial={{ opacity: 0, boxShadow: "0 0 0 0 rgba(107,216,203,0)" }}
        animate={{
          opacity: [0, 1, 1],
          boxShadow: [
            "0 0 0 0 rgba(107,216,203,0)",
            "0 0 16px 4px rgba(107,216,203,0.35)",
            "0 0 10px 2px rgba(107,216,203,0.18)",
          ],
        }}
        transition={{
          duration: 2,
          delay: 1.5,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      />

      <Link
        href={href}
        id="hero-cta-launch"
        className="relative inline-flex h-12 items-center gap-2 rounded-lg bg-primary px-7 text-sm font-semibold text-primary-foreground transition-all duration-200 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {label}
        <motion.span
          initial={{ x: 0 }}
          whileHover={{ x: 3 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <ArrowRight className="size-4" aria-hidden />
        </motion.span>
      </Link>
    </div>
  );
}
