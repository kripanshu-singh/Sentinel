import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScreenshotTabs } from "@/components/screenshot-tabs";
import { AgentHeroSimulator } from "@/components/agent-hero-simulator";
import { ProcurementRoiCalculator } from "@/components/procurement-roi-calculator";
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  GitMerge,
  FileDown,
  Radio,
  Play,
  CheckCircle2,
  Layers,
  Tv,
  Check,
  X,
  Sliders,
  Store,
} from "lucide-react";
import { openWalkthroughVideo } from "@/components/video-modal";

/* ─────────────────────────── data ─────────────────────────── */

const STATS = [
  {
    value: "100% HITL Guardrails",
    label: "Human approval required for any high-stakes variance or price creep.",
  },
  {
    value: "Real-Time SSE Stream",
    label: "Every Playwright DOM action & decision visible line-by-line as it happens.",
  },
  {
    value: "Normalized Invoice Export",
    label: "Generates structured CSV invoice reports with line-item discrepancy flags.",
  },
  {
    value: "Multi-Store Audit Engine",
    label: "Compare pricing, shipping, & discount rules across 2+ vendor storefronts.",
  },
];

const PIPELINE_STEPS = [
  {
    num: "01",
    title: "Define Prompt & Target Ceiling",
    body: "Write your procurement goal in plain English — specify SKUs, target unit prices (e.g. $4.00/unit), quantities, and discount promo codes.",
    icon: Sliders,
  },
  {
    num: "02",
    title: "Autonomous Navigation",
    body: "Sentinel opens the targeted vendor portal, resolves direct product search URLs, extracts live catalog prices, and builds your cart.",
    icon: Zap,
  },
  {
    num: "03",
    title: "HITL Guardrail Intercept",
    body: "If a price variance exceeds your tolerance or a promo code fails, Sentinel pauses execution and surfaces an interactive approval card.",
    icon: ShieldCheck,
  },
  {
    num: "04",
    title: "Normalized Invoice Export",
    body: "Sentinel fills order forms, stops at the final review screen (never completes payment), and exports a clean itemized CSV summary.",
    icon: FileDown,
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Goal-Driven Navigation",
    body: "Translates plain-English procurement instructions into precise browser execution plans across any storefront.",
  },
  {
    icon: ShieldCheck,
    title: "Price Variance Guardrails",
    body: "Configure target unit prices and variance thresholds. Any price creep triggers a human approval checkpoint.",
  },
  {
    icon: CheckCircle2,
    title: "Coupon Validation & Recovery",
    body: "Applies promo codes, detects portal error messages ('Invalid Code'), logs failures, and falls back to wholesale tiers.",
  },
  {
    icon: Radio,
    title: "Real-Time HITL Interceptor",
    body: "A blocking approval modal surfaces exact discrepancy metrics — allowing you to Approve, Override, or Abort.",
  },
  {
    icon: Layers,
    title: "Multi-Channel Pricing Audit",
    body: "Compares unit cost, shipping fees, and discount tiers across multiple vendors (Amazon, eBay, B&H, custom portals).",
  },
  {
    icon: FileDown,
    title: "Structured CSV Export",
    body: "Generates clean, normalized itemized invoices ready for ERP entry or accounting review with one click.",
  },
];

const VENDORS = [
  { name: "Amazon Business", type: "B2B E-Commerce" },
  { name: "eBay Enterprise", type: "Marketplace" },
  { name: "Target B2B", type: "Retail Supply" },
  { name: "B&H Photo Video", type: "Electronics" },
  { name: "SauceDemo Portal", type: "Mock Storefront" },
  { name: "Custom Web Store", type: "Direct EDI / Portal" },
];

const COMPARISON = [
  {
    feature: "Checkout Safety",
    ungated: "Runs autonomously to checkout with zero budget caps",
    sentinel: "Pauses execution & requires human sign-off on any variance",
  },
  {
    feature: "Coupon Failure Handling",
    ungated: "Crashes or silently pays full price when code fails",
    sentinel: "Logs error, applies fallback policy, & asks for approval",
  },
  {
    feature: "Visibility & Audit Trail",
    ungated: "Black box execution with no line-by-line logs",
    sentinel: "Real-time SSE event stream with browser screenshots",
  },
  {
    feature: "Data Output",
    ungated: "Unstructured HTML text or raw DOM dump",
    sentinel: "Normalized, itemized CSV ready for accounting",
  },
];

/* ─────────────────────────── components ─────────────────────────── */

function LandingNav() {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between h-16 px-5 md:px-8 bg-background/80 backdrop-blur-xl border-b border-border/80 transition-all">
      <Link
        href="/"
        className="flex items-center gap-2.5 shrink-0 group"
        aria-label="Sentinel home"
      >
        <div className="size-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-all">
          <Image
            src="/favicon.svg"
            alt="Sentinel logo"
            width={20}
            height={20}
            className="size-5"
            aria-hidden
          />
        </div>
        <span className="text-lg font-bold tracking-tight text-foreground font-heading">
          Sentinel
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 leading-none font-semibold">
          v0.1
        </span>
      </Link>

      <nav className="flex items-center gap-1">
        <Link
          href="#how-it-works"
          className="hidden md:inline-flex text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-accent"
        >
          How it works
        </Link>
        <Link
          href="#roi-calculator"
          className="hidden md:inline-flex text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-accent"
        >
          ROI Calculator
        </Link>
        <Link
          href="#features"
          className="hidden md:inline-flex text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-accent"
        >
          Capabilities
        </Link>
        <button
          type="button"
          onClick={openWalkthroughVideo}
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2 rounded-lg hover:bg-accent cursor-pointer"
        >
          <Tv className="size-3.5 text-primary" aria-hidden="true" />
          <span>Watch Demo</span>
        </button>
        <Separator orientation="vertical" className="hidden sm:block mx-2 self-center h-4" />
        <Button render={<Link href="/app" />} size="sm" className="gap-1.5 shadow-md font-semibold text-xs px-4">
          Launch App
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </nav>
    </header>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-dvh w-full flex-1 bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      <LandingNav />

      {/* ── Hero Section ─────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center text-center px-5 pt-20 pb-16 md:pt-28 md:pb-24 overflow-hidden">
        {/* Subsurface Ambient Background Grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 15%, var(--color-primary) 0%, transparent 60%)",
          }}
        />

        {/* Live Status Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-mono text-primary mb-6 relative z-10 shadow-sm">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold uppercase tracking-wider text-[11px]">
            100% Human-In-The-Loop Guardrail Agent
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-heading text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground max-w-4xl leading-[1.08] mb-6 relative z-10">
          Procurement workflows,{" "}
          <br className="hidden sm:block" />
          <span className="text-primary font-bold">
            executed with guardrails.
          </span>
        </h1>

        {/* Sub-copy */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl leading-relaxed mb-8 relative z-10">
          Sentinel takes plain-English procurement goals, navigates vendor portals, validates unit pricing & coupons against contract rules, and pauses for human approval before high-stakes actions.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-3 flex-wrap justify-center relative z-10 mb-8">
          <Button render={<Link href="/app" />} size="lg" className="gap-2 px-7 py-6 text-sm font-semibold shadow-xl">
            <Play className="size-4" aria-hidden="true" />
            Launch Sentinel
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={openWalkthroughVideo}
            className="gap-2 px-6 py-6 text-sm border-primary/30 bg-card/60 hover:bg-primary/10 hover:border-primary/50 text-foreground cursor-pointer backdrop-blur-md shadow-md"
          >
            <Tv className="size-4 text-primary" aria-hidden="true" />
            Watch Walkthrough (2 min)
          </Button>
        </div>

        {/* Interactive Agent Simulator Widget */}
        <AgentHeroSimulator />
      </section>

      {/* ── Stats Strip ──────────────────────────────────────── */}
      <section className="border-y border-border/80 bg-muted/30 py-12">
        <div className="max-w-6xl mx-auto px-5 md:px-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((stat) => (
            <div
              key={stat.value}
              className="p-5 rounded-2xl border border-border/60 bg-card/70 backdrop-blur-md flex flex-col justify-between"
            >
              <span className="text-base font-bold font-mono text-foreground mb-1">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground leading-relaxed">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Execution Pipeline ("How it works") ─────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="py-24 md:py-32 px-5 md:px-8 scroll-mt-16"
      >
        <div className="max-w-6xl mx-auto">
          {/* Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="font-mono text-xs text-primary font-semibold uppercase tracking-widest block mb-3">
              Execution Architecture
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              From prompt to invoice — with total transparency.
            </h2>
            <p className="text-sm text-muted-foreground mt-3">
              Sentinel isn&apos;t a black box. Every step is evaluated against business guardrails before execution.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PIPELINE_STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="p-6 rounded-2xl border border-border/80 bg-card/80 backdrop-blur-md flex flex-col justify-between relative group hover:border-primary/50 transition-all shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-xs text-primary font-bold px-2 py-1 rounded bg-primary/10 border border-primary/20">
                        {step.num}
                      </span>
                      <div className="size-8 rounded-lg bg-muted flex items-center justify-center text-foreground">
                        <Icon className="size-4" />
                      </div>
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-2">
                      {step.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Product Experience Studio (Screenshot Tabs) ────────────────────────── */}
      <section className="py-20 px-5 md:px-8 border-t border-border/80 bg-muted/20">
        <div className="max-w-6xl mx-auto text-center">
          <span className="font-mono text-xs text-primary font-semibold uppercase tracking-widest block mb-3">
            Product Experience Studio
          </span>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground max-w-2xl mx-auto">
            Experience the Sentinel workspace.
          </h2>
          <ScreenshotTabs />
        </div>
      </section>

      {/* ── ROI Calculator Section ────────────────────────────────────────── */}
      <section id="roi-calculator" className="py-20 px-5 md:px-8 scroll-mt-16">
        <ProcurementRoiCalculator />
      </section>

      {/* ── Capabilities Matrix ────────────────────────────────────── */}
      <section
        id="features"
        className="py-24 md:py-32 px-5 md:px-8 border-t border-border/80 bg-muted/20 scroll-mt-16"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="font-mono text-xs text-primary font-semibold uppercase tracking-widest block mb-3">
              Capabilities
            </span>
            <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Built for procurement that can&apos;t afford surprises.
            </h2>
            <p className="text-sm text-muted-foreground mt-3">
              Every feature is engineered to prevent price creep, catch bad promos, and standardize B2B order auditing.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="bg-card/80 backdrop-blur-md p-6 rounded-2xl border border-border/80 flex flex-col gap-4 shadow-sm hover:border-primary/40 transition-all"
                >
                  <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-base font-semibold text-foreground">
                      {feat.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {feat.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Guardrails vs Un-Gated Agents Comparison ─────────────────────── */}
      <section className="py-24 px-5 md:px-8 border-t border-border/80">
        <div className="max-w-5xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="font-mono text-xs text-primary font-semibold uppercase tracking-widest block mb-3">
              Why Guardrails Matter
            </span>
            <h2 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Sentinel vs. Un-gated AI Agents
            </h2>
            <p className="text-sm text-muted-foreground mt-2">
              Why enterprise B2B buyers trust Sentinel&apos;s human-in-the-loop architecture.
            </p>
          </div>

          <div className="rounded-2xl border border-border/80 overflow-hidden bg-card shadow-xl">
            <div className="grid grid-cols-12 bg-muted/60 p-4 border-b border-border/80 font-mono text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-4 sm:col-span-3">Feature</div>
              <div className="col-span-4 sm:col-span-4 text-destructive flex items-center gap-1">
                <X className="size-3.5" /> Un-gated AI Scripting
              </div>
              <div className="col-span-4 sm:col-span-5 text-primary flex items-center gap-1">
                <Check className="size-3.5 text-primary" /> Sentinel Guardrail Agent
              </div>
            </div>

            <div className="divide-y divide-border/60">
              {COMPARISON.map((row) => (
                <div key={row.feature} className="grid grid-cols-12 p-4 text-xs items-center gap-2">
                  <div className="col-span-4 sm:col-span-3 font-semibold text-foreground">{row.feature}</div>
                  <div className="col-span-4 sm:col-span-4 text-muted-foreground">{row.ungated}</div>
                  <div className="col-span-4 sm:col-span-5 font-medium text-foreground bg-primary/5 p-2 rounded-lg border border-primary/20">
                    {row.sentinel}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Supported Vendor Portals ─────────────────────────────────────── */}
      <section className="py-16 px-5 md:px-8 border-t border-border/80 bg-muted/20">
        <div className="max-w-5xl mx-auto text-center">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest block mb-6">
            Supported Storefronts & Vendor Portals
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {VENDORS.map((v) => (
              <div
                key={v.name}
                className="p-3.5 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm text-center flex flex-col items-center justify-center gap-1"
              >
                <Store className="size-4 text-primary opacity-80" />
                <span className="text-xs font-semibold text-foreground">{v.name}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{v.type}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="py-28 md:py-36 px-5 md:px-8 border-t border-border/80 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 50%, var(--color-primary) 0%, transparent 70%)",
          }}
        />

        <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-6 relative z-10">
          <div className="size-14 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center shadow-lg">
            <GitMerge className="size-7" aria-hidden="true" />
          </div>
          <h2 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Ready to execute your first B2B procurement workflow?
          </h2>
          <p className="text-base text-muted-foreground max-w-lg leading-relaxed">
            Specify your prompt, set target price ceilings, and let Sentinel handle storefront navigation with 100% human-in-the-loop guardrails.
          </p>
          <Button render={<Link href="/app" />} size="lg" className="gap-2 px-8 py-6 text-sm font-semibold shadow-xl mt-2">
            <Play className="size-4" aria-hidden="true" />
            Launch Sentinel
          </Button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border/80 py-10 px-5 md:px-8 bg-muted/30">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="size-6 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Image
                src="/favicon.svg"
                alt="Sentinel logo"
                width={14}
                height={14}
                className="size-3.5"
                aria-hidden
              />
            </div>
            <span className="text-sm font-bold text-foreground font-heading">
              Sentinel
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              — B2B Vendor Order & Discrepancy Agent
            </span>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            <span>Built by Kripanshu Singh</span>
            <Separator orientation="vertical" className="h-3" />
            <a
              href="https://kripanshu.me"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              kripanshu.me
            </a>
            <Separator orientation="vertical" className="h-3" />
            <a
              href="https://github.com/kripanshu-singh"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
