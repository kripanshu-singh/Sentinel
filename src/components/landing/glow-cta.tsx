"use client";

import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * GlowCta — Primary hero CTA.
 *
 * On mount the SVG border traces itself; a soft aura pulse follows. The
 * button itself is a gradient primary with a periodic shine sweep that glides
 * across, plus a hover lift. Remains a server-rendered <Link>; all animation
 * lives in decorative layers.
 */
export function GlowCta({
  href,
  label = "Launch the console",
}: {
  href: string;
  label?: string;
}) {
  const reduced = useReducedMotion() ?? false;
  const r = 8;
  const sw = 1.5;

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
          animate={{
            pathLength: reduced ? 1 : 1,
            opacity: reduced ? 1 : 1,
          }}
          transition={
            reduced
              ? undefined
              : {
                  pathLength: { duration: 1.1, delay: 1.1, ease: [0.4, 0, 0.2, 1] },
                  opacity: { duration: 0.01, delay: 1.1 },
                }
          }
        />
      </motion.svg>

      {/* Pulsing aura — starts after trace completes */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-lg"
        initial={{ opacity: 0, boxShadow: "0 0 0 0 rgba(107,216,203,0)" }}
        animate={
          reduced
            ? {}
            : {
                opacity: [0, 1, 1],
                boxShadow: [
                  "0 0 0 0 rgba(107,216,203,0)",
                  "0 0 18px 4px rgba(107,216,203,0.28)",
                  "0 0 10px 2px rgba(107,216,203,0.14)",
                ],
              }
        }
        transition={
          reduced
            ? undefined
            : {
                duration: 2.2,
                delay: 2,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }
        }
      />

      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-2 rounded-2xl"
        initial={{ opacity: 0 }}
        animate={reduced ? {} : { opacity: [0, 1, 1, 0] }}
        transition={
          reduced
            ? undefined
            : {
                duration: 4.4,
                delay: 1.2,
                repeat: Infinity,
                repeatType: "loop",
                ease: "easeInOut",
              }
        }
      >
        <span className="absolute inset-0 rounded-2xl border border-primary/10" />
      </motion.span>

      <Link
        href={href}
        id="hero-cta-launch"
        className="group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-lg bg-linear-to-b from-primary to-primary/85 px-7 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-[background-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        {label}
        <ArrowRight
          className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />

        {/* Periodic shine sweep */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          <motion.span
            className="absolute inset-y-0 left-0 w-2/5 skew-x-[-20deg] bg-linear-to-r from-transparent via-white/25 to-transparent"
            initial={{ x: "-140%" }}
            animate={reduced ? undefined : { x: ["-140%", "360%"] }}
            transition={
              reduced
                ? undefined
                : {
                    duration: 2.6,
                    repeat: Infinity,
                    repeatDelay: 2.6,
                    ease: "easeInOut",
                  }
            }
          />
        </motion.span>
      </Link>
    </div>
  );
}