"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tv, ExternalLink } from "lucide-react";

export const YOUTUBE_VIDEO_ID = "9WwNKLbv4Kw";
export const YOUTUBE_VIDEO_URL = "https://youtu.be/9WwNKLbv4Kw";
export const YOUTUBE_EMBED_URL = `https://www.youtube-nocookie.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&rel=0`;

export function openWalkthroughVideo() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("sentinel:open-walkthrough-video"));
  }
}

interface VideoModalProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function VideoModal({ open: controlledOpen, onOpenChange }: VideoModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;

  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setInternalOpen(newOpen);
    }
  };

  useEffect(() => {
    const handleCustomOpen = () => setInternalOpen(true);
    window.addEventListener("sentinel:open-walkthrough-video", handleCustomOpen);
    return () => window.removeEventListener("sentinel:open-walkthrough-video", handleCustomOpen);
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-3xl md:max-w-4xl p-4 sm:p-6 overflow-hidden bg-background/95 backdrop-blur-xl border-border">
        <DialogHeader className="flex flex-row items-center justify-between gap-4 pr-6 pb-1 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Tv className="size-4.5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base sm:text-lg font-semibold tracking-tight">
                  Sentinel — Application Walkthrough
                </DialogTitle>
                <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4">
                  Video Demo
                </Badge>
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                See Sentinel execute end-to-end B2B vendor procurement with real-time HITL reconciliation.
              </DialogDescription>
            </div>
          </div>

          <a
            href={YOUTUBE_VIDEO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <span>Open in YouTube</span>
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </DialogHeader>

        {/* Video Container */}
        <div className="relative mt-2 w-full overflow-hidden rounded-xl border border-border/80 bg-black aspect-video shadow-2xl">
          {isOpen ? (
            <iframe
              src={YOUTUBE_EMBED_URL}
              title="Sentinel Application Walkthrough Video"
              className="absolute inset-0 size-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
