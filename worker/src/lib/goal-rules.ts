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
export function extractTargetSubtotal(goal: string): number | undefined {
  if (!goal) return undefined;

  const SUB_PATTERNS = [
    // Subtotal / total budget limits, e.g. "subtotal does not exceed $50", "total goes above $40", "budget of $100"
    /(?:subtotal|total|combined|budget)[\s\S]{0,50}?(?:exceed|exceeds|exceeded|above|over|higher\s+than|under|below|at\s+most|limit|of|is)\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /budget\s+of\s+\$?\s*(\d+(?:\.\d{1,2})?)/i
  ];

  for (const pattern of SUB_PATTERNS) {
    const match = pattern.exec(goal);
    if (match?.[1]) {
      const value = parseFloat(match[1]);
      if (Number.isFinite(value) && value > 0) return value;
    }
  }
  return undefined;
}

export function extractTargetPrice(goal: string): number | undefined {
  if (!goal) return undefined;

  const MAX_TARGET_PATTERNS: RegExp[] = [
    // Explicit unit price words: "unit price is higher than $25", "price is higher than $25"
    /(?:(?:unit\s+)?price|cost|rate)\s+(?:is\s+)?(?:higher\s+than|greater\s+than|more\s+than|\bexceeds?\b|\bexceeding\b|\babove\b|\bover\b)\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /(?:(?:unit\s+)?price|cost|rate)\s+(?:is\s+)?(?:under|below|at\s+most|less\s+than|limit\s+of)\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /(?:target(?:ed)?\s+(?:price|cost)|expected\s+(?:price|cost)|price\s+(?:target|cap))\s+(?:of|is|at|:)?\s*\$?\s*(\d+(?:\.\d{1,2})?)/i,
    // General price patterns but explicitly checking that "subtotal", "total", or "budget" is NOT preceding it closely
    /(?<!subtotal|total|combined|budget)[\s\S]{0,10}(?:higher\s+than|greater\s+than|more\s+than|\bexceeds?\b|\bexceeding\b|\babove\b|\bover\b)\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
    /(?<!subtotal|total|combined|budget)[\s\S]{0,10}(?:under|below|less\s+than|no\s+more\s+than|at\s+most|max(?:imum)?\s+of?|up\s+to|within|cap(?:ped)?\s+at)\s+\$?\s*(\d+(?:\.\d{1,2})?)/i,
  ];

  const subtotal = extractTargetSubtotal(goal);

  for (const pattern of MAX_TARGET_PATTERNS) {
    const match = pattern.exec(goal);
    if (match?.[1]) {
      const value = parseFloat(match[1]);
      if (Number.isFinite(value) && value > 0) {
        // Prevent double extraction of subtotal as a unit price
        if (subtotal !== undefined && Math.abs(value - subtotal) < 0.01) {
          continue;
        }
        return value;
      }
    }
  }

  return undefined;
}
