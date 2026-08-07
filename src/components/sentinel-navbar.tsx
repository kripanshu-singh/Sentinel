"use client";

import * as React from "react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ShieldCheck,
  Plus,
  ChevronRight,
  Compass,
  ExternalLink,
  Globe,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTour } from "@/components/onboarding/tour-provider";

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
  const { start: startTour } = useTour();
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
            <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
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
          <Breadcrumb className="flex items-center min-w-0">
            <BreadcrumbList className="flex items-center min-w-0 gap-1.5 text-sm">
              <BreadcrumbSeparator className="size-3.5 text-muted-foreground/50 shrink-0 flex items-center justify-center">
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </BreadcrumbSeparator>
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={i}>
                    <BreadcrumbItem className="flex items-center min-w-0">
                      {crumb.href && !isLast ? (
                        <BreadcrumbLink
                          render={<Link href={crumb.href} />}
                          className="truncate max-w-[150px] sm:max-w-none text-muted-foreground"
                        >
                          {crumb.label}
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage className="truncate max-w-[150px] sm:max-w-none font-medium text-foreground">
                          {crumb.label}
                        </BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                    {!isLast && (
                      <BreadcrumbSeparator className="size-3.5 text-muted-foreground/50 shrink-0 flex items-center justify-center">
                        <ChevronRight className="size-3.5" aria-hidden="true" />
                      </BreadcrumbSeparator>
                    )}
                  </React.Fragment>
                );
              })}

              {statusBadge && (
                <li className="inline-flex items-center ml-0.5 shrink-0">
                  <Badge
                    className={cn(
                      "text-[10px] font-bold uppercase tracking-wider h-5 px-2 border-transparent",
                      statusBadge.variant === "primary"
                        ? "bg-primary/10 text-primary hover:bg-primary/15"
                        : "bg-destructive/10 text-destructive hover:bg-destructive/15",
                    )}
                  >
                    {statusBadge.label}
                  </Badge>
                </li>
              )}
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onNewRun}
                className="gap-1.5 text-muted-foreground"
                render={!onNewRun ? <Link href="/" /> : undefined}
              />
            }
          >
            {onNewRun ? (
              <>
                <Plus className="size-3.5" aria-hidden="true" />
                New run
              </>
            ) : (
              <span className="flex items-center gap-1.5">
                <Plus className="size-3.5" aria-hidden="true" />
                New run
              </span>
            )}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Start a new procurement run
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="mx-1 self-center" />

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={startTour}
              />
            }
          >
            <Compass className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Tour</span>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Take a quick tour of this screen
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Avatar
                size="sm"
                className="ml-1 cursor-pointer outline-hidden transition-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              />
            }
          >
            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
              K
            </AvatarFallback>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-52">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <span className="text-xs text-muted-foreground">
                  Kripanshu Singh
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <a
                  href="https://kripanshu.me"
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <Globe
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Portfolio
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <a
                  href="https://kripanshu.me/resume.pdf"
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <FileText
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              Resume
            </DropdownMenuItem>
            <DropdownMenuItem
              render={
                <a
                  href="https://github.com/kripanshu-singh"
                  target="_blank"
                  rel="noreferrer"
                />
              }
            >
              <ExternalLink
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              GitHub
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
