import Link from "next/link";
import {
  ShieldCheck,
  ArrowRight,
  Activity,
  Target,
  Layers,
  FileSpreadsheet,
  Crosshair,
  GitMerge,
} from "lucide-react";
import { Navbar } from "@/components/landing/nav";
import { RunBoard } from "@/components/landing/run-board";
import { VendorMarquee } from "@/components/landing/vendor-marquee";
import { Reveal } from "@/components/landing/reveal";
import { PipelineExplorer } from "@/components/landing/pipeline-explorer";
import { Faq } from "@/components/landing/faq";
import { WatchButton } from "@/components/landing/watch-button";
import { ScreenshotTabs } from "@/components/screenshot-tabs";
import { HeroCanvas } from "@/components/landing/hero-canvas";
import { SplitHeadline } from "@/components/landing/split-headline";
import { GlowCta } from "@/components/landing/glow-cta";
import { CtaBloom } from "@/components/landing/cta-bloom";

const STAT_POINTS = [
  {
    icon: ShieldCheck,
    value: "0 unchecked",
    label: "A high-stakes step is never taken without a human sign-off.",
  },
  {
    icon: Activity,
    value: "1 live stream",
    label: "Every Playwright action rendered line-by-line over SSE.",
  },
  {
    icon: Target,
    value: "±1/10 tolerance",
    label: "Unit drift measured in percent, paused at any breach.",
  },
  {
    icon: FileSpreadsheet,
    value: "RFC 4180 CSV",
    label: "Itemized reconciliation reports export to any ledger.",
  },
];

const PRINCIPLES = [
  {
    icon: Crosshair,
    tag: "Explainable",
    title: "Every step, on the record",
    body: "Each navigate, extract, and click streams as an event. Nothing recursive happens blind: the operator sees the agent's reasoning as it executes.",
  },
  {
    icon: GitMerge,
    tag: "Recoverable",
    title: "Failures route, they don't crash",
    body: "Expired coupon, missing DOM field, slow render — every failure maps to a fallback policy. The run recovers or surfaces the choice, never dies mid-flight.",
  },
  {
    icon: ShieldCheck,
    tag: "Guarded",
    title: "Zero-unapproved spend",
    body: "The agent stops at the final order draft. Approve, override, or abort — the release gate is always human, always before money moves.",
  },
  {
    icon: Layers,
    tag: "Structured",
    title: "Output you can reconcile",
    body: "Discrepancies, line items, and channel snapshots normalize into one contract, ready for CSV export into your accounting stack.",
  },
];

const COMPARISON = [
  {
    feature: "Unit price vs. target ceiling",
    ungated: "Accepts whatever the DOM shows",
    sentinel: "Compares to contract, pauses on drift",
  },
  {
    feature: "Discount / coupon failure",
    ungated: "Crash or silently pays full price",
    sentinel: "Logs portal error, applies fallback policy",
  },
  {
    feature: "Execution visibility",
    ungated: "Black box, no line-by-line log",
    sentinel: "Real-time SSE event thread, live screenshots",
  },
  {
    feature: "Point of payment",
    ungated: "Can reach checkout with no budget cap",
    sentinel: "Hard stop before any order placement",
  },
  {
    feature: "Reporting contract",
    ungated: "Unstructured DOM dump",
    sentinel: "Normalized, itemized, exportable CSV",
  },
];

export default function LandingPage() {
  return (
    <div id="top" className="w-full min-h-dvh bg-background text-foreground selection:bg-primary/30 selection:text-primary-foreground">
      <Navbar />

      <main>
        {/* ── Hero ─────────────────────────────────────────────── */}
        <section className="relative overflow-hidden">
          {/* WebGL teal noise field — full bleed, absolutely positioned */}
          <HeroCanvas />

          {/* Subtle grid floor on top of canvas — retained for brand texture */}
          <div
            className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] [background-size:64px_64px] opacity-[0.08]"
            aria-hidden
          />

          <div className="relative mx-auto max-w-7xl px-5 pb-20 pt-16 md:px-8 md:pb-28 md:pt-24">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="font-heading text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl md:text-6xl">
                <SplitHeadline
                  text="Procurement that runs itself — with a human at every gate."
                  accentWords={["human", "every", "gate."]}
                />
              </h1>
              <Reveal delay={0.6}>
                <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground">
                  Sentinel is a guardrailed agent for B2B buying. Give it a goal in plain English; it
                  navigates vendor storefronts, builds the cart, validates every unit price and coupon
                  against your contract — then pauses for your sign-off before anything high-stakes
                  moves.
                </p>
              </Reveal>
              <Reveal delay={0.8}>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <GlowCta href="/app" label="Launch the console" />
                  <WatchButton />
                </div>
              </Reveal>
            </div>

            <Reveal delay={0.2} className="relative z-10 mt-16">
              <RunBoard />
            </Reveal>
          </div>

          <div className="relative border-y border-border/60 bg-foreground/[0.02]">
            <div className="mx-auto max-w-7xl px-5 py-4 md:px-8">
              <p className="mb-3 text-center font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                / a live thread against every storefront in your catalog /
              </p>
              <VendorMarquee />
            </div>
          </div>
        </section>

        {/* ── Quick stats ───────────────────────────────────────── */}
        <section className="border-b border-border/60 bg-background">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-px px-5 py-14 md:grid-cols-4 md:px-8">
            {STAT_POINTS.map((s, i) => (
              <Reveal key={s.value} delay={i * 0.06} className="flex flex-col gap-2 px-2 py-4 md:px-6">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                    <s.icon className="size-4 text-primary" aria-hidden />
                  </span>
                  <span className="font-mono text-sm font-semibold text-foreground">{s.value}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── How it works ─────────────────────────────────────── */}
        <section id="how-it-works" className="scroll-mt-20 border-b border-border/60 bg-background">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
            <div className="mb-14 max-w-2xl">
              <Reveal>
                <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/5 px-3 py-1 font-mono text-[11px] tracking-widest text-primary">
                  <Target className="size-3" aria-hidden />
                  THE THREAD
                </span>
                <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  From a sentence to a reconciled invoice.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  Five stages, one guardrail the whole way. Click a stage to watch the trace.
                </p>
              </Reveal>
            </div>
            <Reveal delay={0.1}>
              <PipelineExplorer />
            </Reveal>
          </div>
        </section>

        {/* ── Capabilities ─────────────────────────────────────── */}
        <section id="capabilities" className="scroll-mt-20 border-b border-border/60 bg-background">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <div className="mb-14 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
                <div className="max-w-2xl">
                  <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                    Built for procurement that can&apos;t afford a surprise.
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                    Every capability exists because a missed price check once cost a quarter. No
                    flair — just the guardrails.
                  </p>
                </div>
              </div>
            </Reveal>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {PRINCIPLES.map((p, i) => (
                <div
                  key={p.title}
                  className={
                    i % 2 === 0
                      ? "lg:col-span-1"
                      : "lg:col-span-1 lg:translate-y-8"
                  }
                >
                  <Reveal delay={i * 0.06}>
                    <div className="group h-full rounded-2xl border border-border/70 bg-foreground/[0.02] p-7 transition-colors hover:border-primary/40">
                      <div className="mb-5 flex items-center gap-3">
                        <span className="flex size-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10">
                          <p.icon className="size-5 text-primary" aria-hidden />
                        </span>
                        <span className="rounded-full border border-border/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                          {p.tag}
                        </span>
                      </div>
                      <h3 className="font-heading text-xl font-semibold tracking-tight text-foreground">
                        {p.title}
                      </h3>
                      <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                    </div>
                  </Reveal>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Product studio ───────────────────────────────────── */}
        <section id="at-work" className="scroll-mt-20 border-b border-border/60 bg-background">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <div className="mx-auto mb-12 max-w-2xl text-center">
                <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Inside the operations console.
                </h2>
                <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                  The real product — a goal, a live run, and the reconciled report at the end.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <ScreenshotTabs />
            </Reveal>
          </div>
        </section>

        {/* ── Guardrails vs. ungated ───────────────────────────── */}
        <section className="border-b border-border/60 bg-background">
          <div className="mx-auto max-w-5xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <div className="mb-12 text-center">
                <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Uraised agents buy. Sentinel signs.
                </h2>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <div className="overflow-hidden rounded-2xl border border-border/70">
                <div className="grid grid-cols-12 gap-0 border-b border-border/70 bg-foreground/[0.04] px-6 py-4 font-mono text-[11px] uppercase tracking-widest">
                  <div className="col-span-12 text-foreground sm:col-span-4">Capability</div>
                  <div className="col-span-6 text-destructive sm:col-span-4 sm:pl-4">Ungated script</div>
                  <div className="col-span-6 text-primary sm:col-span-4 sm:pl-4">Sentinel</div>
                </div>
                {COMPARISON.map((row) => (
                  <div
                    key={row.feature}
                    className="grid grid-cols-12 gap-0 border-b border-border/50 px-6 py-4 last:border-b-0"
                  >
                    <div className="col-span-12 mb-2 flex items-center gap-2 text-sm font-medium text-foreground sm:col-span-4 sm:mb-0">
                      <span className="size-1.5 rounded-full bg-primary/50" aria-hidden />
                      {row.feature}
                    </div>
                    <div className="col-span-6 pr-3 text-xs leading-relaxed text-muted-foreground sm:col-span-4 sm:pl-4">
                      {row.ungated}
                    </div>
                    <div className="col-span-6 border-l border-primary/25 pl-3 text-xs font-medium leading-relaxed text-primary sm:col-span-4 sm:pl-4">
                      {row.sentinel}
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────── */}
        <section id="faq" className="scroll-mt-20 border-b border-border/60 bg-background">
          <div className="mx-auto max-w-7xl px-5 py-20 md:px-8 md:py-28">
            <Reveal>
              <div className="mx-auto mb-12 max-w-2xl text-center">
                <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Questions, before you launch.
                </h2>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <Faq />
            </Reveal>
          </div>
        </section>

        {/* ── Final CTA ────────────────────────────────────────── */}
        {/*
          Dark obsidian panel — intentionally inverts the page's light world
          at the very end to create a cinematic, high-contrast moment.
          The teal bloom canvas fills the panel; text and buttons are on top.
          We do NOT use dark: utilities — instead we explicitly set the
          obsidian/teal values inline via semantic class names that match the
          .dark token values. The section itself uses bg-[#15191b] which is the
          brand inverse-surface value, not an arbitrary dark default.
        */}
        <section className="bg-background">
          <div className="mx-auto max-w-7xl px-5 py-24 md:px-8 md:py-32">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl border border-[#6bd8cb]/20 bg-[#15191b] px-6 py-16 text-center md:px-16 md:py-24">
                {/* Obsidian bloom canvas */}
                <CtaBloom />

                {/* Content — z-10 so it sits above the canvas */}
                <div className="relative z-10">
                  {/* Icon badge */}
                  <span className="mx-auto mb-8 flex size-16 items-center justify-center rounded-2xl border border-[#6bd8cb]/25 bg-[#6bd8cb]/10">
                    <ShieldCheck className="size-8 text-[#6bd8cb]" aria-hidden />
                  </span>

                  <h2 className="mx-auto max-w-2xl font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
                    Ready to put a guard on{" "}
                    <span className="text-[#6bd8cb]">your next order run?</span>
                  </h2>

                  <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/60">
                    Set a goal, pin a target price, and let Sentinel navigate while you keep the
                    final say. First run is free.
                  </p>

                  <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                    {/* Primary — bright teal fill */}
                    <Link
                      href="/app"
                      id="final-cta-launch"
                      className="inline-flex h-12 items-center gap-2 rounded-lg bg-[#6bd8cb] px-8 text-sm font-semibold text-[#00201d] transition-all duration-200 hover:bg-[#6bd8cb]/85 hover:shadow-xl hover:shadow-[#6bd8cb]/25"
                    >
                      Launch the console
                      <ArrowRight className="size-4" aria-hidden />
                    </Link>

                    {/* Secondary — ghost, teal border */}
                    <WatchButton label="Watch it run" />
                  </div>

                  {/* Subtle trust signal */}
                  <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.2em] text-white/30">
                    / zero-unapproved spend · 100% human-in-the-loop /
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-foreground/[0.02]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 py-10 md:flex-row md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-7 items-center justify-center rounded-md border border-primary/30 bg-primary/10">
              <ShieldCheck className="size-3.5 text-primary" aria-hidden />
            </span>
            <span className="font-heading text-sm font-bold tracking-tight text-foreground">Sentinel</span>
            <span className="font-mono text-xs text-muted-foreground">
              B2B Vendor Order & Discrepancy Reconciliation Agent
            </span>
          </div>

          <div className="flex items-center gap-5 font-mono text-xs text-muted-foreground">
            <span>Built by Kripanshu Singh</span>
            <a
              href="https://kripanshu.me"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              kripanshu.me
            </a>
            <a
              href="https://github.com/kripanshu-singh"
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-foreground"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}