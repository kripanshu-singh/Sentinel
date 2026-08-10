"use client";

import { useQuery } from "@tanstack/react-query";
import type { QuotaSnapshot } from "@/types";

/**
 * Loads the anonymous visitor's execution allowance. This is the display value
 * only — the worker re-checks quotas atomically at run start, so a stale UI
 * count can never grant an extra run.
 */
export function useQuota() {
  return useQuery<QuotaSnapshot>({
    queryKey: ["quota"],
    queryFn: async () => {
      const res = await fetch("/api/quota");
      if (!res.ok) throw new Error("Failed to load quota");
      return res.json() as Promise<QuotaSnapshot>;
    },
    retry: 1,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}