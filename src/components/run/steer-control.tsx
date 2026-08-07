"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, LoaderCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface SteerControlProps {
  runId: string;
  isTerminal: boolean;
}

export function SteerControl({ runId, isTerminal }: SteerControlProps) {
  const [instruction, setInstruction] = useState("");
  const [sentSuccess, setSentSuccess] = useState(false);

  const steerMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`/api/runs/${encodeURIComponent(runId)}/steer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: text }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? `Error ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      setInstruction("");
      setSentSuccess(true);
      setTimeout(() => {
        setSentSuccess(false);
      }, 5000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = instruction.trim();
    if (!trimmed || isTerminal || steerMutation.isPending) return;
    setSentSuccess(false);
    steerMutation.mutate(trimmed);
  };

  return (
    <div
      className="bg-card border border-border rounded-xl p-4 flex flex-col gap-3 shrink-0 shadow-2xs"
      id="tour-run-steer"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor="steer-instruction-input"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          Steer the agent
        </label>
        <p className="text-[11px] text-muted-foreground leading-normal">
          Provide a live operator redirect. Instruction takes effect at the next step boundary.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
        <textarea
          id="steer-instruction-input"
          value={instruction}
          onChange={(e) => {
            setInstruction(e.target.value);
            if (steerMutation.isError) steerMutation.reset();
          }}
          disabled={isTerminal || steerMutation.isPending}
          rows={3}
          maxLength={500}
          placeholder="e.g. Skip the coupon and add 2 units of Infant Dress instead."
          className={cn(
            "w-full resize-none px-3 py-2 border border-border rounded-lg bg-background text-xs text-foreground placeholder:text-muted-foreground",
            "focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        />

        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">
            {instruction.length}/500
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={isTerminal || !instruction.trim() || steerMutation.isPending}
            className="gap-2"
          >
            {steerMutation.isPending ? (
              <LoaderCircle className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <Send className="size-3.5" data-icon="inline-start" />
            )}
            Send instruction
          </Button>
        </div>
      </form>

      {sentSuccess && (
        <Alert variant="default" className="border-primary/30 bg-primary/5 text-primary text-xs py-2">
          <CheckCircle2 className="size-4 text-primary" />
          <AlertTitle className="text-xs font-semibold text-primary">Sent</AlertTitle>
          <AlertDescription className="text-[11px] text-primary/90">
            Sentinel will apply this at its next step.
          </AlertDescription>
        </Alert>
      )}

      {steerMutation.isError && (
        <Alert variant="destructive" className="text-xs py-2">
          <AlertCircle className="size-4" />
          <AlertTitle className="text-xs font-semibold">Failed to send steer</AlertTitle>
          <AlertDescription className="text-[11px] flex flex-col gap-1.5 mt-1">
            <span>{steerMutation.error?.message ?? "An unexpected error occurred."}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const trimmed = instruction.trim();
                if (trimmed) steerMutation.mutate(trimmed);
              }}
              className="w-fit h-6 px-2 text-[10px] text-destructive border-destructive/30 hover:bg-destructive/10"
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
