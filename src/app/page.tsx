"use client";

import { useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SidebarInset } from "@/components/ui/sidebar";
import { Input } from "@/components/ui/input";
import { SentinelNavbar } from "@/components/sentinel-navbar";
import {
  Play,
  Paperclip,
  Globe,
  Backpack,
  Bike,
  Workflow,
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

const FALLBACK_OPTIONS = [
  { value: "default_wholesale", label: "Default wholesale tier" },
  { value: "best_available", label: "Best available code" },
  { value: "abort", label: "Abort run" },
];

interface SuggestedWorkflow {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  goal: string;
  targetUnitPrice?: string;
  targetSubtotal?: string;
  varianceThresholdPct?: string;
  discountCode?: string;
  fallbackPolicy?: string;
}

const SUGGESTED_WORKFLOWS: SuggestedWorkflow[] = [
  {
    icon: Bike,
    title: "Guarded Jacket & Light Purchase",
    description:
      "Procure Fleece Jacket and Bike Light. Guard with a combined subtotal threshold of $50.00 and 10% variance limit.",
    goal: "Procure the 'Sauce Labs Fleece Jacket' and 'Sauce Labs Bike Light' from the store. Verify that the combined item subtotal does not exceed $50.00. If the subtotal variance exceeds 10%, pause execution and request human authorization before proceeding to checkout.",
    targetSubtotal: "50.00",
    varianceThresholdPct: "10",
    fallbackPolicy: "default_wholesale",
  },
  {
    icon: Backpack,
    title: "Backpack Approval Check",
    description:
      "Find the Sauce Labs Backpack and enforce a strict price ceiling of $25.00 before adding to cart.",
    goal: "Login to the store, find the Sauce Labs Backpack, check its price. If the price is higher than $25, pause and ask for approval before adding it to the cart. Then proceed to checkout.",
    targetUnitPrice: "25.00",
    varianceThresholdPct: "0",
    fallbackPolicy: "default_wholesale",
  },
  {
    icon: Workflow,
    title: "Infant Dress Procurement",
    description:
      "Find and buy a dress for the infant on a strict budget of $10.00.",
    goal: "So I need to buy the dress for the infant. And my budget is $10. So I want you to find the dress and add to cart and checkout.",
    targetUnitPrice:"10.00",
    varianceThresholdPct: "0",
    fallbackPolicy: "abort",
  },
];

export default function GoalInputPage() {
  const [goal, setGoal] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [targetSubtotal, setTargetSubtotal] = useState("");
  const [variancePct, setVariancePct] = useState("10");
  const [discountCode, setDiscountCode] = useState("");
  const [fallback, setFallback] = useState("default_wholesale");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [assistantMessage, setAssistantMessage] =
    useState<AssistantMessage | null>(null);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const router = useRouter();

  function handleWorkflowClick(workflow: string | SuggestedWorkflow) {
    if (typeof workflow === "string") {
      setGoal(workflow);
      setAssistantMessage(null);
      return;
    }
    setGoal(workflow.goal);
    setTargetPrice(workflow.targetUnitPrice ?? "");
    setTargetSubtotal(workflow.targetSubtotal ?? "");
    setVariancePct(workflow.varianceThresholdPct ?? "10");
    setDiscountCode(workflow.discountCode ?? "");
    setFallback(workflow.fallbackPolicy ?? "default_wholesale");
    setAssistantMessage(null);
  }

  function handleNewWorkflow() {
    setGoal("");
    setTargetPrice("");
    setTargetSubtotal("");
    setVariancePct("10");
    setDiscountCode("");
    setFallback("default_wholesale");
    setSubmitError(null);
    setAssistantMessage(null);
    setConversation([]);
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
          targetSubtotal: targetSubtotal ? parseFloat(targetSubtotal) : undefined,
          varianceThresholdPct: parseFloat(variancePct) ?? 10,
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
      <SentinelNavbar onNewRun={handleNewWorkflow} /> 

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
            <fieldset className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4 shadow-sm">
              <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2">
                Business Rules
              </legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Target Unit Price */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="target-price" className="text-xs font-medium text-muted-foreground">
                    Target Unit Price
                  </label>
                  <div className="flex items-center h-8 rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-all overflow-hidden">
                    <span className="px-2.5 h-full bg-muted/40 text-muted-foreground text-xs font-mono border-r border-input flex items-center justify-center select-none shrink-0">
                      $
                    </span>
                    <input
                      id="target-price"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={targetPrice}
                      onChange={(e) => setTargetPrice(e.target.value)}
                      className="flex-1 h-full px-2.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-0 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Target Subtotal */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="target-subtotal" className="text-xs font-medium text-muted-foreground">
                    Target Subtotal
                  </label>
                  <div className="flex items-center h-8 rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-all overflow-hidden">
                    <span className="px-2.5 h-full bg-muted/40 text-muted-foreground text-xs font-mono border-r border-input flex items-center justify-center select-none shrink-0">
                      $
                    </span>
                    <input
                      id="target-subtotal"
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={targetSubtotal}
                      onChange={(e) => setTargetSubtotal(e.target.value)}
                      className="flex-1 h-full px-2.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-0 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Variance Threshold */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="variance" className="text-xs font-medium text-muted-foreground">
                    Variance Threshold
                  </label>
                  <div className="flex items-center h-8 rounded-lg border border-input bg-transparent focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 transition-all overflow-hidden">
                    <input
                      id="variance"
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      placeholder="10"
                      value={variancePct}
                      onChange={(e) => setVariancePct(e.target.value)}
                      className="flex-1 h-full px-2.5 bg-transparent text-sm text-foreground placeholder:text-muted-foreground border-none outline-none focus:ring-0 focus:outline-none"
                    />
                    <span className="px-2.5 h-full bg-muted/40 text-muted-foreground text-xs font-mono border-l border-input flex items-center justify-center select-none shrink-0">
                      %
                    </span>
                  </div>
                </div>

                {/* Discount Code */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="discount-code" className="text-xs font-medium text-muted-foreground">
                    Discount Code
                  </label>
                  <Input
                    id="discount-code"
                    type="text"
                    placeholder="e.g. SUMMER20"
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value)}
                    className="h-8"
                  />
                </div>

                {/* Fallback Policy */}
                <div className="flex flex-col gap-1.5 sm:col-span-2 md:col-span-2">
                  <label htmlFor="fallback" className="text-xs font-medium text-muted-foreground">
                    Fallback Policy
                  </label>
                  <select
                    id="fallback"
                    value={fallback}
                    onChange={(e) => setFallback(e.target.value)}
                    className="h-8 px-2.5 border border-input rounded-lg bg-card text-sm text-foreground focus:border-ring focus:ring-3 focus:ring-ring/50 focus:outline-none transition-all outline-none"
                  >
                    {FALLBACK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>
          </form>

          {/* Suggested workflows */}
          <div className="w-full mt-10">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-widest mb-4">
              Suggested Workflows
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SUGGESTED_WORKFLOWS.map((workflow) => {
                const Icon = workflow.icon;
                return (
                  <button
                    key={workflow.title}
                    type="button"
                    onClick={() => handleWorkflowClick(workflow)}
                    className="group text-left bg-card border border-border rounded-xl p-4 hover:border-primary/50 hover:shadow-sm cursor-pointer transition-all"
                  >
                    <div className="size-8 rounded-lg bg-accent flex items-center justify-center mb-3 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">
                      {workflow.title}
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                      {workflow.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </SidebarInset>
  );
}
