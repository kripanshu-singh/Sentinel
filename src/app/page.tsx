"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import {
  Play,
  Paperclip,
  Globe,
  ClipboardCheck,
  Percent,
  RefreshCcw,
  Bell,
  HelpCircle,
  Bot,
  Sparkles,
} from "lucide-react";

type ConversationTurn = { role: "user" | "assistant"; content: string };

type HelpContent = {
  intro: string;
  capabilities: { title: string; description: string; example: string }[];
};

type AssistantMessage =
  | {
      kind: "conversational";
      reply: string;
    }
  | {
      kind: "help";
      help: HelpContent;
    };

const SUGGESTED_WORKFLOWS = [
  {
    icon: ClipboardCheck,
    title: "Audit Inventory",
    description: "Cross-reference warehouse API counts with recent POS data.",
    goal: "Audit the inventory by cross-referencing warehouse counts with POS data for the last 30 days. Flag any discrepancies above 5%.",
  },
  {
    icon: Percent,
    title: "Verify Discounts",
    description: "Check wholesale bulk tiers against current vendor contracts.",
    goal: "Verify discount codes BULK10 and WHOLESALE20 against our current vendor contracts. Report any codes that are expired or misconfigured.",
  },
  {
    icon: RefreshCcw,
    title: "Re-order Low Stock",
    description: "Identify SKUs below threshold and draft purchase orders.",
    goal: "Identify all SKUs below the reorder threshold of 50 units and draft purchase orders for the primary vendor at contracted pricing.",
  },
];

const FALLBACK_OPTIONS = [
  { value: "default_wholesale", label: "Default wholesale tier" },
  { value: "best_available", label: "Best available code" },
  { value: "abort", label: "Abort" },
];

export default function GoalInputPage() {
  const [goal, setGoal] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [variancePct, setVariancePct] = useState("10");
  const [discountCode, setDiscountCode] = useState("");
  const [fallback, setFallback] = useState("default_wholesale");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [assistantMessage, setAssistantMessage] =
    useState<AssistantMessage | null>(null);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const router = useRouter();

  function handleWorkflowClick(workflowGoal: string) {
    setGoal(workflowGoal);
    setAssistantMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!goal.trim()) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const history = conversation.slice(-12);
    const userTurn: ConversationTurn = { role: "user", content: goal.trim() };

    try {
      const res = await fetch("/api/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goal.trim(),
          targetUnitPrice: targetPrice ? parseFloat(targetPrice) : undefined,
          varianceThresholdPct: parseFloat(variancePct) || 10,
          discountCode: discountCode.trim() || undefined,
          fallbackPolicy: fallback,
          history,
        }),
      });

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      const data = (await res.json()) as {
        intent: "CONVERSATIONAL" | "CAPABILITY_QUERY" | "AUTOMATION_TASK";
        reply?: string;
        help?: HelpContent;
        runId?: string;
      };

      if (data.intent === "AUTOMATION_TASK") {
        setConversation([]);
        router.push(`/runs/${data.runId}`);
        return;
      }

      if (data.intent === "CAPABILITY_QUERY" && data.help) {
        setConversation([...history, userTurn]);
        setAssistantMessage({ kind: "help", help: data.help });
      } else {
        const reply = data.reply ?? "";
        setConversation([
          ...history,
          userTurn,
          { role: "assistant", content: reply },
        ]);
        setAssistantMessage({ kind: "conversational", reply });
      }
      setIsSubmitting(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to start run";
      setSubmitError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <SidebarInset>
      {/* Top Bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between h-14 px-4 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <span className="hover:text-primary cursor-pointer transition-colors">
              Reconciliation
            </span>
            <span className="hover:text-primary cursor-pointer transition-colors">
              Audit
            </span>
            <span className="hover:text-primary cursor-pointer transition-colors">
              Vendor Analysis
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="text-muted-foreground hover:text-primary transition-colors">
            <Bell className="size-4" />
          </button>
          <button className="text-muted-foreground hover:text-primary transition-colors">
            <HelpCircle className="size-4" />
          </button>
          <div className="size-8 rounded-full bg-muted border border-border overflow-hidden">
            <div className="size-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
              <span className="text-primary text-xs font-semibold">EA</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 py-12 relative overflow-hidden">
        {/* Teal radial glow */}
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(ellipse 60% 40% at 50% 0%, #6bd8cb 0%, transparent 70%)",
          }}
        />

        <div className="w-full max-w-2xl flex flex-col items-center relative z-10">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground mb-2 text-center">
            Sentinel
          </h1>
          <p className="text-base text-muted-foreground mb-10 text-center max-w-xl">
            B2B Vendor Order &amp; Discrepancy Reconciliation Agent. Describe
            your procurement task — Sentinel executes it with human-in-the-loop
            guardrails.
          </p>

          <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
            {/* Assistant reply for non-task prompts */}
            {assistantMessage?.kind === "conversational" && (
              <div className="w-full flex items-start gap-3 bg-card border border-border rounded-xl p-4">
                <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Bot className="size-4" />
                </div>
                <p className="text-sm text-foreground leading-relaxed">
                  {assistantMessage.reply}
                </p>
              </div>
            )}

            {assistantMessage?.kind === "help" && (
              <div className="w-full bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  <p className="text-sm font-medium text-foreground">
                    {assistantMessage.help.intro}
                  </p>
                </div>
                <ul className="flex flex-col gap-2">
                  {assistantMessage.help.capabilities.map((capability) => (
                    <li key={capability.title}>
                      <button
                        type="button"
                        onClick={() => handleWorkflowClick(capability.example)}
                        className="w-full text-left flex flex-col gap-1 bg-accent/50 border border-border rounded-lg px-4 py-3 hover:border-primary/50 transition-colors"
                      >
                        <span className="text-sm font-semibold text-foreground">
                          {capability.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {capability.description}
                        </span>
                        <span className="text-xs text-primary truncate">
                          {capability.example}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Goal textarea */}
            <div className="w-full relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-primary/10 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none" />
              <div className="relative bg-card rounded-xl border border-border overflow-hidden flex flex-col shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                <label htmlFor="goal" className="sr-only">
                  Procurement goal
                </label>
                <textarea
                  id="goal"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  className="w-full min-h-[140px] resize-none border-none bg-transparent p-5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-0 focus:outline-none"
                  placeholder="Build a cart with 5 units of Organic Almond Milk and 10 units of Oat Milk, apply SUMMER20, and fill the shipping form."
                />
                <div className="flex justify-between items-center px-4 py-3 bg-muted/30 border-t border-border">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Attach document"
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded transition-colors"
                    >
                      <Paperclip className="size-4" />
                    </button>
                    <button
                      type="button"
                      title="Use web search"
                      className="p-1.5 text-muted-foreground hover:text-primary hover:bg-accent rounded transition-colors"
                    >
                      <Globe className="size-4" />
                    </button>
                  </div>
                  <Button
                    type="submit"
                    disabled={!goal.trim() || isSubmitting}
                    className="gap-2"
                    size="sm"
                  >
                    {isSubmitting ? (
                      <span className="size-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                    ) : (
                      <Play className="size-4" />
                    )}
                    Start run
                  </Button>
                </div>
              </div>
            </div>

            {/* Submit error */}
            {submitError && (
              <p
                role="alert"
                className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-2"
              >
                {submitError}
              </p>
            )}

            {/* Business rules */}
            {/* <fieldset className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
              <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                Business rules
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="target-price"
                    className="text-sm font-medium text-foreground"
                  >
                    Target unit price
                  </label>
                  <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                    <span className="px-3 py-2 bg-muted text-muted-foreground text-sm border-r border-border select-none">
                      $
                    </span>
                    <input
                      id="target-price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="4.00"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      className="flex-1 px-3 py-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground border-none focus:ring-0 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="variance"
                    className="text-sm font-medium text-foreground"
                  >
                    Variance threshold (%)
                  </label>
                  <div className="flex items-center border border-border rounded-lg overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
                    <input
                      id="variance"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={variancePct}
                      onChange={(e) => setVariancePct(e.target.value)}
                      className="flex-1 px-3 py-2 bg-transparent text-sm text-foreground placeholder:text-muted-foreground border-none focus:ring-0 focus:outline-none"
                    />
                    <span className="px-3 py-2 bg-muted text-muted-foreground text-sm border-l border-border select-none">
                      %
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="discount-code"
                    className="text-sm font-medium text-foreground"
                  >
                    Discount code
                  </label>
                  <input
                    id="discount-code"
                    type="text"
                    placeholder="SUMMER20"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                  />
                </div>

             
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="fallback"
                    className="text-sm font-medium text-foreground"
                  >
                    Fallback policy
                  </label>
                  <select
                    id="fallback"
                    value={fallback}
                    onChange={(e) => setFallback(e.target.value)}
                    className="px-3 py-2 border border-border rounded-lg bg-card text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all"
                  >
                    {FALLBACK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset> */}
          </form>

          {/* Suggested workflows */}
          <div className="w-full mt-10">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">
              Suggested Workflows
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SUGGESTED_WORKFLOWS.map(
                ({ icon: Icon, title, description, goal: wGoal }) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => handleWorkflowClick(wGoal)}
                    className="group text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all"
                  >
                    <div className="size-8 rounded-lg bg-accent flex items-center justify-center mb-3 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      {title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {description}
                    </p>
                  </button>
                ),
              )}
            </div>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
}
