"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TourStep } from "./tour-steps";
import { X } from "lucide-react";

interface TourOverlayProps {
  active: boolean;
  index: number;
  steps: TourStep[];
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Gap between the spotlight border and the target element. */
const PAD = 10;
/** Dim colour painted everywhere except the spotlight hole. */
const DIM = "rgba(6,16,19,0.55)";

function measureRect(id: string): Rect | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Track the bounding box of the active target. Returns `null` while no target
 * is active or before the first measurement lands.
 *
 * The returned `rect` is not tagged with the step id: when the step changes the
 * box briefly holds the previous value rather than becoming `null`, so the
 * spotlight element stays mounted and `motion` springs it between positions
 * instead of snapping.
 */
function useTargetRect(active: boolean, targetId: string | undefined) {
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!active || !targetId) return;
    const measure = () => {
      const next = measureRect(targetId);
      setRect((prev) =>
        prev &&
        next &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };
    const initial = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    const el = document.getElementById(targetId);
    const ro = el ? new ResizeObserver(measure) : null;
    ro?.observe(el as Element);
    return () => {
      window.cancelAnimationFrame(initial);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
      ro?.disconnect();
    };
  }, [active, targetId]);

  return rect;
}

const CARD_W = 384;

function placeCard(
  spot: Rect | null,
  cardH: number,
): { top: number; left: number } {
  if (typeof window === "undefined") {
    return { top: 0, left: 0 };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 16;

  if (!spot) {
    return {
      top: Math.max(margin, vh / 2 - cardH / 2),
      left: Math.max(margin, vw / 2 - CARD_W / 2),
    };
  }

  // Centre horizontally over the spot, clamped to the viewport.
  let left = spot.left + spot.width / 2 - CARD_W / 2;
  left = Math.min(Math.max(left, margin), vw - CARD_W - margin);

  // Prefer below, then above, then fall back to centring vertically.
  const below = spot.top + spot.height + PAD;
  const above = spot.top - cardH - PAD;
  let top: number;
  if (below + cardH + margin <= vh) top = below;
  else if (above >= margin) top = above;
  else top = Math.max(margin, vh / 2 - cardH / 2);

  return { top, left };
}

function TooltipCard({
  step,
  index,
  total,
  onClose,
  onNext,
  onPrevious,
}: {
  step: TourStep;
  index: number;
  total: number;
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
}) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const centered = !step.targetId;
  const Icon = step.icon;

  return (
    <motion.div
      className="w-[min(92vw,384px)] rounded-2xl border border-border bg-card p-5 shadow-2xl"
      initial={{ opacity: 0, y: 12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.97 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="step-title"
      aria-describedby="step-body"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
              {step.eyebrow}
            </span>
            <span className="text-[11px] font-mono text-muted-foreground">
              Step {index + 1} of {total}
            </span>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close tour">
          <X className="size-4" />
        </Button>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5">
        <h2 id="step-title" className="font-heading text-base font-semibold text-foreground">
          {step.title}
        </h2>
        <p id="step-body" className="text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === index ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {!isFirst && !centered && (
            <Button variant="outline" size="sm" onClick={onPrevious}>
              Back
            </Button>
          )}
          <Button size="sm" onClick={onNext}>
            {isLast ? "Finish" : "Next"}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export function TourOverlay({
  active,
  index,
  steps,
  onClose,
  onNext,
  onPrevious,
}: TourOverlayProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const step = steps[index];
  const targetRect = useTargetRect(active, step?.targetId);

  // Rough card height for placement; measured lazily on the first paint is
  // unnecessary here since placement only needs to stay inside the viewport.
  const cardPos = useMemo(
    () => (step?.targetId ? placeCard(targetRect, 280) : placeCard(null, 280)),
    [targetRect, step?.targetId],
  );

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {active && step && (
        <div className="fixed inset-0 z-50 pointer-events-none">
          {/* Spotlight: dims everything except the hole around the target.
              No `key` here — the element must persist across steps so motion
              springs the hole from one target to the next. */}
          {targetRect && (
            <motion.div
              aria-hidden
              className="fixed"
              initial={false}
              animate={{
                top: targetRect.top - PAD,
                left: targetRect.left - PAD,
                width: targetRect.width + PAD * 2,
                height: targetRect.height + PAD * 2,
              }}
              transition={{ type: "spring", stiffness: 280, damping: 26, mass: 0.9 }}
            >
              <span
                className="block size-full rounded-3xl"
                style={{
                  boxShadow: `0 0 0 9999px ${DIM}`,
                  outline: "2px solid rgba(0,190,170,0.6)",
                  outlineOffset: "2px",
                }}
              />
            </motion.div>
          )}

          {/* Tooltip card — top/left live in `animate` so it glides with the
              spotlight rather than snapping between steps. */}
          {cardPos && (
            <motion.div
              className="pointer-events-auto fixed"
              initial={false}
              animate={{ top: cardPos.top, left: cardPos.left }}
              transition={{ type: "spring", stiffness: 280, damping: 26, mass: 0.9 }}
            >
              <TooltipCard
                step={step}
                index={index}
                total={steps.length}
                onClose={onClose}
                onNext={onNext}
                onPrevious={onPrevious}
              />
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}