"use client";

import { Play } from "lucide-react";
import { openWalkthroughVideo } from "@/components/video-modal";

export function WatchButton({ label = "Watch the walkthrough" }: { label?: string }) {
  return (
    <button
      onClick={openWalkthroughVideo}
      className="inline-flex h-11 items-center gap-2 rounded-lg border border-border/80 bg-foreground/[0.02] px-6 font-mono text-sm text-foreground transition-colors hover:bg-foreground/[0.05]"
    >
      <Play className="size-3.5 text-primary" aria-hidden />
      {label}
    </button>
  );
}