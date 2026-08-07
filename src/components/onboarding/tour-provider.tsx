"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { TourOverlay } from "./tour-overlay";
import { HOME_TOUR, type TourStep } from "./tour-steps";

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

export function TourProvider({ children }: { children: ReactNode }) {
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
      if (prev >= HOME_TOUR.length - 1) {
        setActive(false);
        markSeen();
        return prev;
      }
      return prev + 1;
    });
  }, []);

  const previous = useCallback(() => {
    setIndex((prev) => Math.max(0, prev - 1));
  }, []);

  // Auto-launch the tour on a first-time visit, after the page settles.
  useEffect(() => {
    if (readSeen()) return;
    const timer = window.setTimeout(() => {
      start();
    }, AUTO_LAUNCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [start]);

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

  const value: TourContextValue = {
    active,
    index,
    steps: HOME_TOUR,
    total: HOME_TOUR.length,
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
        steps={HOME_TOUR}
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