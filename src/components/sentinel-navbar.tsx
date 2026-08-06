"use client";

import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ShieldCheck, Plus, Bell, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Breadcrumb segment shown in the center-left of the navbar.
 * Omit to show nothing (used on the home/goal page).
 */
export interface NavBreadcrumb {
  /** href if the segment should be a link */
  href?: string;
  label: string;
}

interface SentinelNavbarProps {
  /** Breadcrumb segments rendered after the brand. */
  breadcrumbs?: NavBreadcrumb[];
  /** Badge rendered alongside the last breadcrumb (e.g. run status). */
  statusBadge?: {
    label: string;
    /** "primary" = teal/success, "destructive" = red */
    variant: "primary" | "destructive";
  };
  /** Called when the user clicks "+ New run". */
  onNewRun?: () => void;
}

export function SentinelNavbar({
  breadcrumbs,
  statusBadge,
  onNewRun,
}: SentinelNavbarProps) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-5 bg-background/80 backdrop-blur-md border-b border-border">
      {/* Left: Brand + optional breadcrumbs */}
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Brand */}
        <Link
          href="/"
          className="flex items-center gap-2 shrink-0 group"
          aria-label="Sentinel home"
        >
          <div className="flex items-center justify-center size-7 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
            <ShieldCheck
              className="size-4 text-primary"
              aria-hidden="true"
            />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Sentinel
          </span>
          <Badge
            variant="secondary"
            className="text-[10px] px-1.5 py-0 h-4 font-mono"
          >
            v0.1
          </Badge>
        </Link>

        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 min-w-0"
          >
            <ChevronRight
              className="size-3.5 text-muted-foreground/50 shrink-0"
              aria-hidden="true"
            />
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <div key={i} className="flex items-center gap-1.5 min-w-0">
                  {crumb.href && !isLast ? (
                    <Link
                      href={crumb.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors truncate"
                    >
                      {crumb.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "text-sm truncate",
                        isLast
                          ? "text-foreground font-medium"
                          : "text-muted-foreground",
                      )}
                    >
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && (
                    <ChevronRight
                      className="size-3.5 text-muted-foreground/50 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </div>
              );
            })}

            {statusBadge && (
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ml-0.5 shrink-0",
                  statusBadge.variant === "primary" &&
                    "bg-primary/10 text-primary",
                  statusBadge.variant === "destructive" &&
                    "bg-destructive/10 text-destructive",
                )}
              >
                {statusBadge.label}
              </span>
            )}
          </nav>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onNewRun}
              asChild={!onNewRun}
              className="gap-1.5 text-muted-foreground"
            >
              {onNewRun ? (
                <>
                  <Plus className="size-3.5" aria-hidden="true" />
                  New run
                </>
              ) : (
                <Link href="/" className="flex items-center gap-1.5">
                  <Plus className="size-3.5" aria-hidden="true" />
                  New run
                </Link>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Start a new procurement run
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 self-center" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground relative"
              aria-label="Notifications"
            >
              <Bell className="size-4" aria-hidden="true" />
              <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Notifications</TooltipContent>
        </Tooltip>

        <Avatar size="sm" className="ml-1 cursor-pointer">
          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
            EA
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}
