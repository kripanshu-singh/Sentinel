"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Play } from "lucide-react";
import { openWalkthroughVideo } from "@/components/video-modal";

const LINKS = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#capabilities", label: "Capabilities" },
  { href: "#at-work", label: "At work" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:px-8">
        <a href="#top" className="flex items-center gap-3">
          <img
            src="/favicon.svg"
            alt="Sentinel"
            className="size-8 rounded-lg"
            width={32}
            height={32}
          />
          <span className="font-heading text-lg font-bold tracking-tight text-foreground">Sentinel</span>
          <span className="hidden rounded-full border border-border/70 px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted-foreground sm:inline-block">
            OPS
          </span>
        </a>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={openWalkthroughVideo}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/70 px-3.5 font-mono text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Play className="size-3.5 text-primary" aria-hidden />
            Watch run
          </button>
          <Link
            href="/app"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Launch console
          </Link>
        </div>

        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          className="flex size-9 items-center justify-center rounded-lg border border-border/70 text-foreground md:hidden"
        >
          <span className="relative block h-3.5 w-4">
            <motion.span
              animate={open ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
              className="absolute left-0 top-0 h-0.5 w-4 bg-foreground"
            />
            <motion.span
              animate={open ? { rotate: -45, y: -4 } : { rotate: 0, y: 0 }}
              className="absolute left-0 top-2 h-0.5 w-4 bg-foreground"
            />
          </span>
        </button>
      </div>

      {open && (
        <motion.nav
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t border-border/60 bg-background/95 px-5 py-4 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm text-foreground/90 transition-colors hover:bg-foreground/[0.04]"
              >
                {l.label}
              </a>
            ))}
            <Link
              href="/app"
              className="mt-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              Launch console
            </Link>
          </div>
        </motion.nav>
      )}
    </header>
  );
}