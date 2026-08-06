/**
 * worker/src/lib/goal-rules.ts
 *
 * Rule-based extraction of business rules from free-text goal prompts.
 * Currently: target unit price. Mirrors nothing on the frontend — this is the
 * authoritative derivation point at run creation (POST /runs), so callers that
 * omit an explicit `targetUnitPrice` still get one when the prompt states one.
 */

/**
 * Extract a target/maximum unit price from a goal prompt, e.g.
 *   "If the price is higher than $25, pause and ask for approval"
 *   "verify unit price for Almond Milk 1L under $4.50"
 *   "budget of $120"
 *
 * Only the first numeric match wins; the phrasing is matched from strongest to
 * weakest so that "higher than $25" is not overridden by an unrelated dollar
 * figure later in the prompt.
 */
export function extractTargetPrice(goal: string): number | undefined {
  if (!goal) return undefined;

  const MAX_TARGET_PATTERNS: RegExp[] = [
    // Explicit cap phrasing: "if the price is higher than $25", "above $25",
    // "exceeds $25", "over $25", "more than $25".
    /(?:if\s+(?:the\s+)?(?:unit\s+)?price\s+is\s+higher\s+than|(?:unit\s+)?price\s+(?:is\s+)?higher\s+than|higher\s+than|greater\s+than|more\s+than|\bexceeds?\b|\bexceeding\b|\babove\b|\bover\b)\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    // Upper-bound phrasing: "under $4.50", "at most $25", "up to $25",
    // "cap(ed) at $25", "not to exceed $25", "price limit of $25".
    /(?:(?:unit\s+)?price\s+(?:is\s+)?(?:under|below|at\s+most|less\s+than)|under|below|less\s+than|no\s+more\s+than|at\s+most|max(?:imum)?\s+of?|up\s+to|within|cap(?:ped)?\s+at|budget\s+of?|price\s+limit\s+of?|not\s+to\s+exceed)\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    // Explicit target words: "target price of $25", "expected cost is $4.50".
    /(?:target(?:ed)?\s+(?:price|cost)|expected\s+(?:price|cost)|price\s+(?:target|cap))\s+(?:of|is|at|:)?\s*\$?\s*(\d+(?:\.\d{1,2})?)/i,
  ];

  for (const pattern of MAX_TARGET_PATTERNS) {
    const match = pattern.exec(goal);
    if (match?.[1]) {
      const value = parseFloat(match[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }

  return undefined;
}
