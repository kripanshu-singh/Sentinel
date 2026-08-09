"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

/**
 * SplitHeadline — Splits a headline into words and animates each word
 * with a staggered spring entrance (y + blur fade).
 *
 * Uses `motion/react` (already installed as `motion@13`). The accent
 * words are passed as `accentWords` and rendered in `text-primary`.
 * All other words render in `text-foreground`.
 *
 * The animation is scroll-triggered via `useInView`, fires once, and
 * degrades to full opacity/position without JS (the initial state is
 * only applied after hydration).
 */
export function SplitHeadline({
  text,
  accentWords = [],
  className,
}: {
  text: string;
  accentWords?: string[];
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const words = text.split(" ");

  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => {
        const isAccent = accentWords.some((a) =>
          a.toLowerCase() === word.toLowerCase().replace(/[—–]/g, "")
        );
        return (
          <motion.span
            key={`${word}-${i}`}
            aria-hidden
            initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
            animate={
              inView
                ? { opacity: 1, y: 0, filter: "blur(0px)" }
                : { opacity: 0, y: 28, filter: "blur(8px)" }
            }
            transition={{
              duration: 0.65,
              delay: i * 0.07,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={`inline-block whitespace-pre ${
              isAccent ? "text-primary" : ""
            }`}
          >
            {word}{" "}
          </motion.span>
        );
      })}
    </span>
  );
}
