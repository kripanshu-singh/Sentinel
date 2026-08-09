"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

/**
 * SplitHeadline — Splits a headline into words and reveals each word with a
 * soft mask wipe (slides up from behind an overflow mask + blur settle).
 *
 * Masked reveals clip with overflow-hidden so each word reads as physically
 * appearing from below, keeping the stagger legible. Accent words render in
 * `text-primary`. Animates once when the headline scrolls into view.
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
  const inView = useInView(ref, { once: true, margin: "-40px" });

  const words = text.split(" ");

  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => {
        const isAccent = accentWords.some(
          (a) => a.toLowerCase() === word.toLowerCase().replace(/[—–]/g, "")
        );
        return (
          <span
            key={`${word}-${i}`}
            aria-hidden
            className="inline-block overflow-hidden pb-[0.13em] -mb-[0.13em] align-bottom"
          >
            <motion.span
              initial={{ y: "112%", opacity: 0 }}
              animate={
                inView
                  ? { y: "0%", opacity: 1 }
                  : { y: "112%", opacity: 0 }
              }
              transition={{
                duration: 0.7,
                delay: 0.15 + i * 0.06,
                ease: [0.16, 1, 0.3, 1],
              }}
              className={`inline-block will-change-transform ${
                isAccent ? "text-primary" : ""
              }`}
            >
              {word}
              {"\u00A0"}
            </motion.span>
          </span>
        );
      })}
    </span>
  );
}