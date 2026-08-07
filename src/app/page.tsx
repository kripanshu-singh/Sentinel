import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScreenshotTabs } from "@/components/screenshot-tabs";
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
} from "lucide-react";

/* ─────────────────────────── data ─────────────────────────── */

const STATS = [
  {
    value: "Human-in-the-loop",
    label: "Required for every high-stakes step",
  },
  {
    value: "Live event stream",
    label: "Every agent action visible in real time",
  },
  {
    value: "Structured output",
    label: "CSV-ready normalized invoice on every run",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Describe your goal",
    body: "Type a plain-English procurement task — products, quantities, discount codes, and any price ceilings you care about.",
  },
  {
    num: "02",
    title: "Sentinel executes",
    body: "The agent navigates the vendor portal, searches for products, validates pricing against your business rules, and fills every form.",
  },
  {
    num: "03",
    title: "You stay in control",
    body: "When a price variance or policy exception is detected, Sentinel pauses and surfaces a clear approval request. You approve, override, or abort.",
  },
];

const FEATURES = [
  {
    icon: Zap,
    title: "Goal-driven navigation",
    body: "Parse any natural-language goal into a multi-step execution plan. No scripting required.",
  },
  {
    icon: ShieldCheck,
    title: "Variance guardrails",
    body: "Define a target unit price and variance threshold. Any drift triggers a human approval checkpoint.",
  },
  {
    icon: CheckCircle2,
    title: "Coupon validation & recovery",
    body: "Apply discount codes, detect portal error messages, and fall back to your configured policy without crashing.",
  },
  {
    icon: Radio,
    title: "HITL intervention",
    body: "A blocking approval modal surfaces discrepancy details as a structured table — approve, override, or abort.",
  },
  {
    icon: Layers,
    title: "Multi-channel pricing audit",
    body: "Compare price, discount, shipping, and margin across two or more vendor stores. Large gaps require confirmation.",
  },
  {
    icon: FileDown,
    title: "Structured invoice export",
    body: "The final normalized invoice renders as an itemized table and exports to CSV with one click.",
  },
];

/* ─────────────────────────── components ─────────────────────────── */

function LandingNav() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-5 md:px-8 bg-background/80 backdrop-blur-md border-b border-border">
      <Link
        href="/"
        className="flex items-center gap-2 shrink-0"
        aria-label="Sentinel home"
      >
        <Image
          src="/favicon.svg"
          alt="Sentinel logo"
          width={24}
          height={24}
          className="size-6"
          aria-hidden
        />
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Sentinel
        </span>
        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border leading-none">
          v0.1
        </span>
      </Link>

      <nav className="flex items-center gap-1">
        <Link
          href="#how-it-works"
          className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent"
        >
          How it works
        </Link>
        <Link
          href="#features"
          className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md hover:bg-accent"
        >
          Features
        </Link>
        <Separator orientation="vertical" className="hidden sm:block mx-1 self-center h-4" />
        <Button render={<Link href="/app" />} size="sm" variant="outline" className="hidden sm:flex gap-1.5">
            Launch app
            <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
        <Button render={<Link href="/app" />} size="sm" className="sm:hidden gap-1.5">
            Launch
            <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>
      </nav>
    </header>
  );
}

/* ─────────────────────────── page ─────────────────────────── */

export default function LandingPage() {
  return (
    <div className="flex flex-col min-h-dvh w-full flex-1 bg-background text-foreground">
      <LandingNav />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative flex flex-col items-center justify-center text-center px-5 pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden">
        {/* Subtle radial tint — matches the existing app's glow */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(ellipse 70% 50% at 50% 0%, #6bd8cb 0%, transparent 70%)",
          }}
        />

        {/* Overline */}
        {/* <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-6 relative z-10">
          B2B Procurement Agent
        </p> */}

        {/* Headline */}
        <h1 className="font-heading text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-foreground max-w-3xl leading-[1.1] mb-6 relative z-10">
          Procurement workflows,
          <br className="hidden sm:block" />{" "}
          <span className="text-primary">executed.</span>
        </h1>

        {/* Sub-copy */}
        <p className="text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed mb-10 relative z-10">
          Sentinel takes a plain-English goal, navigates your vendor portal,
          validates every price and coupon against your business rules, and
          pauses for human approval on anything high-stakes.
        </p>

        {/* CTAs */}
        <div className="flex items-center gap-3 flex-wrap justify-center relative z-10">
          <Button render={<Link href="/app" />} size="lg" className="gap-2 px-6">
            <Play className="size-4" aria-hidden="true" />
            Start a run
          </Button>
          <Button render={<Link href="#how-it-works" />} size="lg" variant="outline" className="gap-2 px-6">
            See how it works
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Screenshot tab switcher */}
        <ScreenshotTabs />
      </section>

      {/* ── Stats strip ──────────────────────────────────────── */}
      <section className="border-y border-border py-10">
        <div className="max-w-5xl mx-auto px-5 md:px-8 grid grid-cols-1 sm:grid-cols-3 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {STATS.map((stat) => (
            <div
              key={stat.value}
              className="flex flex-col gap-1 px-6 py-5 sm:py-0 first:pl-0 last:pr-0 sm:first:pl-0 sm:last:pr-0"
            >
              <span className="text-sm font-semibold text-foreground">
                {stat.value}
              </span>
              <span className="text-xs text-muted-foreground leading-snug">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="py-20 md:py-28 px-5 md:px-8 scroll-mt-14"
      >
        <div className="max-w-5xl mx-auto">
          {/* Section label */}
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-4">
            How it works
          </p>
          <h2 className="font-heading text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-14 max-w-lg">
            Three steps from goal to invoice.
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {STEPS.map((step) => (
              <div key={step.num} className="flex flex-col gap-4">
                <span className="font-mono text-xs text-primary font-semibold tracking-widest">
                  {step.num}
                </span>
                <Separator className="w-8" />
                <h3 className="text-base font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features grid ────────────────────────────────────── */}
      <section
        id="features"
        className="py-20 md:py-28 px-5 md:px-8 border-t border-border scroll-mt-14"
      >
        <div className="max-w-5xl mx-auto">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-widest mb-4">
            Capabilities
          </p>
          <h2 className="font-heading text-2xl md:text-3xl font-semibold tracking-tight text-foreground mb-14 max-w-lg">
            Built for procurement that can&apos;t afford surprises.
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="bg-card p-6 flex flex-col gap-4"
                >
                  <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-sm font-semibold text-foreground">
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

      {/* ── Final CTA ────────────────────────────────────────── */}
      <section className="py-24 md:py-32 px-5 md:px-8 border-t border-border">
        <div className="max-w-2xl mx-auto flex flex-col items-center text-center gap-6">
          <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <GitMerge className="size-6" aria-hidden="true" />
          </div>
          <h2 className="font-heading text-2xl md:text-3xl font-semibold tracking-tight text-foreground">
            Ready to run your first procurement workflow?
          </h2>
          <p className="text-base text-muted-foreground max-w-sm">
            It takes 30 seconds to describe a goal. Sentinel handles the rest.
          </p>
          <Button render={<Link href="/app" />} size="lg" className="gap-2 px-8 mt-2">
            <Play className="size-4" aria-hidden="true" />
            Launch Sentinel
          </Button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="border-t border-border py-8 px-5 md:px-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/favicon.svg"
              alt="Sentinel logo"
              width={16}
              height={16}
              className="size-4"
              aria-hidden
            />
            <span className="text-sm font-medium text-foreground">
              Sentinel
            </span>
            <span className="text-sm text-muted-foreground">
              — B2B Procurement Agent
            </span>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
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
