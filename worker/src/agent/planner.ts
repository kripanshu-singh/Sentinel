/**
 * worker/src/agent/planner.ts
 *
 * LLM-powered goal parser: converts a natural-language GoalInput into a rich
 * PlanResult — a normalized goal, an ordered StepPlan[], and metadata
 * (risk, confidence, clarification flag) that the UI can surface later.
 */

import { getLLMProvider, parseModelJSON, type LLMMessage } from "../llm/client.js";
import type { GoalInput, StepPlan } from "../types/index.js";

export interface PlanResult {
  /** Normalized restatement of the goal. */
  goal: string;
  plan: StepPlan[];
  needsClarification: boolean;
  risk: "low" | "medium" | "high";
  confidence: number; // 0..1
  estimatedSteps: number;
}

function looksLikeSimpleShoppingGoal(goal: string): boolean {
  const normalized = goal.trim().toLowerCase();
  const hasShoppingVerb = /\b(add|buy|purchase|order|search|find|look for|pick|select|grab|get)\b/.test(normalized);
  const hasProductContext = /\b(t[- ]?shirt|shirt|jacket|pants|shoes?|sneakers?|hat|watch|book|phone|laptop|item|product|sku)\b/.test(normalized);
  const hasPriceContext = /\b(?:under|up to|below|at most|max|less than|for)\s*\$?\d+(?:\.\d+)?\b|\$\d+(?:\.\d+)?\b/.test(normalized);
  const hasCartContext = /\b(cart|basket|checkout)\b/.test(normalized);

  return Boolean(
    (hasShoppingVerb && (hasProductContext || hasPriceContext || hasCartContext)) ||
      (hasCartContext && hasPriceContext)
  );
}

export function getFallbackPlan(input: GoalInput): PlanResult {
  if (!looksLikeSimpleShoppingGoal(input.goal)) {
    return {
      goal: input.goal,
      plan: [],
      needsClarification: true,
      risk: "low",
      confidence: 0.3,
      estimatedSteps: 0,
    };
  }

  const normalizedGoal = input.goal.trim();
  const productName = normalizedGoal
    .replace(/^(?:add|buy|purchase|order|search|find|look for|pick|select|grab|get)\s+/i, "")
    .replace(/\s+(?:under|up to|below|at most|max|less than|for|with|in|from)\b.*$/i, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .trim();

  return {
    goal: `Find and add ${productName} to the cart`
      .replace(/\s+/g, " ")
      .trim(),
    plan: [
      {
        kind: "search",
        description: `Search for ${productName}`,
        params: { query: productName },
      },
      {
        kind: "extract_product",
        description: `Review the matching product details for ${productName}`,
        params: { targetName: productName },
      },
      {
        kind: "check_price",
        description: `Check the price and availability for ${productName}`,
        params: { targetName: productName },
      },
      {
        kind: "add_to_cart",
        description: `Add ${productName} to the cart`,
        params: { quantity: 1 },
      },
    ],
    needsClarification: false,
    risk: "low",
    confidence: 0.85,
    estimatedSteps: 4,
  };
}

const SYSTEM_PROMPT = `You are a B2B procurement automation planner.
Given a natural-language procurement goal and business rules, decompose it into
an ordered list of concrete automation steps.

Each step must have:
- kind: one of navigate | search | extract_product | check_price | add_to_cart |
         apply_coupon | fill_form | validate | draft_report
- description: plain English description of this step
- params: an object with kind-specific keys (always include the PRODUCT NAME
  extracted from the goal — never generic placeholders like "milk" or "Almond Milk"):
  - search / extract_product: params.query / params.targetName = the exact product
    name from the goal (e.g. "Sauce Labs Backpack"). Do not invent a product that
    is not in the goal.
  - navigate: params.url when the goal names a specific storefront URL
  - add_to_cart / fill_form: params.quantity / params.fields when given

Steps will be re-ordered into a canonical execution order automatically, so do
not worry about ordering — focus on WHICH steps are needed and their params.

Also return:
- goal: a short normalized restatement of the goal
- needsClarification: true only if the goal is too vague to act on (no product,
  no quantity, no action). Do not invent products, quantities, or URLs.
- risk: low | medium | high — how risky this task feels (high when it places a
  purchase or crosses a spend threshold)
- confidence: 0..1 — how confident you are the plan is actionable
- estimatedSteps: the length of the plan

If the goal is too vague to act on, return an EMPTY plan array [] and
needsClarification: true. Do not return placeholder or "validate only" plans.

Output ONLY a valid JSON object matching the requested schema. No prose, no markdown.`;

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    goal: { type: "string" },
    needsClarification: { type: "boolean" },
    risk: { type: "string", enum: ["low", "medium", "high"] },
    confidence: { type: "number" },
    estimatedSteps: { type: "integer" },
    plan: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: [
              "navigate",
              "search",
              "extract_product",
              "check_price",
              "add_to_cart",
              "apply_coupon",
              "fill_form",
              "validate",
              "draft_report",
            ],
          },
          description: { type: "string" },
          params: { type: "object" },
        },
        required: ["kind", "description", "params"],
      },
    },
  },
  required: ["goal", "plan", "needsClarification", "risk", "confidence", "estimatedSteps"],
};

/**
 * Canonical execution order. The LLM picks WHICH steps to run; this ranks their
 * order so the graph can never fill a cart or hit checkout before searching and
 * extracting (a real failure we hit live: fill_form ran before search).
 */
const STEP_ORDER: Record<string, number> = {
  navigate: 0,
  search: 1,
  extract_product: 2,
  check_price: 3,
  add_to_cart: 4,
  apply_coupon: 5,
  fill_form: 6,
  validate: 7,
  draft_report: 8,
};

const MAX_PLAN_ATTEMPTS = 3;

/**
 * Parse a GoalInput into a PlanResult using the LLM.
 * `failureContext` (Phase C) is appended when replanning after failed steps, so
 * the LLM can avoid the specific strategies that already failed.
 * Retries the generation+parse when the model returns malformed JSON.
 */
export async function planGoal(
  input: GoalInput,
  failureContext?: string
): Promise<PlanResult> {
  const fallbackPlan = getFallbackPlan(input);
  if (!fallbackPlan.needsClarification) {
    return fallbackPlan;
  }

  const llm = getLLMProvider();

  const userPrompt = `
Procurement goal: ${input.goal}

Business rules:
- Target unit price: ${input.targetUnitPrice != null ? `$${input.targetUnitPrice}` : "not set"}
- Variance threshold: ${input.varianceThresholdPct}%
- Discount code: ${input.discountCode ?? "none"}
- Fallback policy: ${input.fallbackPolicy}
${
  failureContext
    ? `

Previous attempts failed. Structured failure history:
${failureContext}

Produce a REVISED step plan that avoids the failed steps (different selectors,
search queries, or fallbacks). You may reuse steps that already succeeded.`
    : ""
}

Generate the step plan.`.trim();

  const messages: LLMMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_PLAN_ATTEMPTS; attempt++) {
    try {
      const text = await llm.generate(
        messages,
        { responseSchema: PLAN_SCHEMA, temperature: 0.1 }
      );
      const result = parseModelJSON<Partial<PlanResult>>(text);

      const plan = Array.isArray(result.plan) ? result.plan : [];
      const orderedPlan = [...plan].sort(
        (a, b) => (STEP_ORDER[a.kind] ?? 99) - (STEP_ORDER[b.kind] ?? 99)
      );
      const needsClarification =
        result.needsClarification === true || orderedPlan.length === 0;

      return {
        goal: typeof result.goal === "string" ? result.goal : input.goal,
        plan: orderedPlan,
        needsClarification,
        risk: result.risk ?? "low",
        confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
        estimatedSteps: orderedPlan.length,
      };
    } catch (error: unknown) {
      // Only malformed JSON (SyntaxError) is worth retrying — a fresh sample may
      // parse fine. API/provider errors (e.g. quota, network) fail fast instead
      // of burning the same doomed request repeatedly.
      if (!(error instanceof SyntaxError)) throw error;
      lastError = error;
      console.warn(
        `[planner] Planning attempt ${attempt}/${MAX_PLAN_ATTEMPTS} returned malformed JSON:`,
        error.message
      );
    }
  }

  throw lastError ?? new Error("Planning failed after retries");
}
