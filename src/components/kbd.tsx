"use client";

import React from "react";
import { cn } from "@/lib/utils";

export function Kbd({ children }: { children?: React.ReactNode }) {
  const isMac = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");
  const label = children ?? (isMac ? "⌘K" : "Ctrl+K");

  return (
    <kbd className={cn("inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-border bg-muted text-[11px] font-mono")}>{label}</kbd>
  );
}

export default Kbd;
