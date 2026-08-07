"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { TourOverlay } from "./tour-overlay";
import { TOURS, type TourStep } from "./tour-steps";

const STORAGE_KEY = "sentinel:onboarded";
const AUTO_LAUNCH_DELAY_MS = 800;

interface TourContextValue {
  active: boolean;
  index: number;
  steps: TourStep[];
  total: number;
  start: () => void;
  stop: () => void;
  next: () => void;
  previous: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

function readSeen(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* storage unavailable */
  }
}

/** Match `next/navigation` pathnames to a tour config. */
function routeFor(pathname: string): keyof typeof TOURS | null {
  if (pathname === "/app") return "home";
  if (pathname.startsWith("/runs/") && pathname.endsWith("/result"))
    return "result";
  if (pathname.startsWith("/runs/")) return "run";
  return null;
}

/**
 * True when a tour step's `targetId` is present in the DOM. Used to auto-skip
 * optional steps whose conditional region hasn't rendered.
 */
function hasTarget(id: string | undefined): boolean {
  if (!id) return false;
  return typeof document !== "undefined" && !!document.getElementById(id);
}

export function TourProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const route = routeFor(pathname);
  const steps = useMemo(() => (route ? TOURS[route] : []), [route]);

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);

  const start = useCallback(() => {
    setIndex(0);
    setActive(true);
    markSeen();
  }, []);

  const stop = useCallback(() => {
    setActive(false);
    markSeen();
  }, []);

  const next = useCallback(() => {
    setIndex((prev) => {
      const tour = route ? TOURS[route] : undefined;
      if (!tour) return prev;
      const limit = tour.length - 1;
      let next = prev + 1;

      // Skip past any optional steps whose target isn't on screen (conditional
      // regions like the HITL panel or channel table).
      while (next <= limit) {
        const step = tour[next];
        if (step?.optional && !hasTarget(step.targetId)) {
          next += 1;
          continue;
        }
        break;
      }

      if (next > limit) {
        setActive(false);
        markSeen();
        return Math.min(prev, limit);
      }
      return next;
    });
  }, [route]);

  const previous = useCallback(() => {
    setIndex((prev) => Math.max(0, prev - 1));
  }, []);

  // Auto-launch the tour on a first-time visit to the home page, after the
  // page settles. Run/result screens rely on the manual tour trigger instead.
  useEffect(() => {
    if (route !== "home") return;
    if (readSeen()) return;
    const timer = window.setTimeout(() => {
      start();
    }, AUTO_LAUNCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [route, start]);

  // Keep body from scrolling while the spotlight overlay is open.
  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [active]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.key === "Escape") stop();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") previous();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, next, previous, stop]);

  // Auto-skip an optional step whose target never appears (e.g. landing on it
  // via Previous) so the tour can't hang on a missing panel.
  useEffect(() => {
    if (!active) return;
    const step = route ? TOURS[route]?.[index] : undefined;
    if (step?.optional && !hasTarget(step.targetId)) {
      const t = window.setTimeout(next, 350);
      return () => window.clearTimeout(t);
    }
  }, [active, index, route, next]);

  const value: TourContextValue = {
    active,
    index,
    steps,
    total: steps.length,
    start,
    stop,
    next,
    previous,
  };

  return (
    <TourContext.Provider value={value}>
      {children}
      <TourOverlay
        active={active}
        index={index}
        steps={steps}
        onClose={stop}
        onNext={next}
        onPrevious={previous}
      />
    </TourContext.Provider>
  );
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used within a TourProvider");
  return ctx;
}