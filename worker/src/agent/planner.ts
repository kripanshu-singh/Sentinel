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

const DEFAULT_STOREFRONT_URL = "https://www.saucedemo.com/";

/**
 * Goals that need reasoning beyond "add <product> to cart" (login, checkout,
 * human approval, conditional price gates, order-summary extraction) are NOT
 * safe for the deterministic fallback. The deterministic fallback would strip
 * those requirements and use the whole goal as a product name, so we force
 * these through the LLM planner instead.
 */
const REQUIRES_LLM_RE =
  /\b(?:login|log in|sign in|signin|sign into|sign out|checkout)\b|(?:\b(?:order\s+)?summary\b)|\b(?:pause|ask|ask me|confirm|approve|approval|human|wait for|review)\b|(?:if\s+the\s+(?:price|item|product)\s+is\s+(?:higher|greater|more)\s+than)|\b(?:do\s+not\s+(?:complete|purchase|buy|checkout)|extract\s+the\s+(?:order|invoice|receipt))\b/i;

/**
 * Goals that ask for human confirmation before a high-stakes action must pause
 * the agent and bring the operator into the loop before the main commit
 * (checkout / finalizing an order).
 */
const REQUIRES_APPROVAL_RE =
  /\b(?:pause|approve|approval|confirm|wait)\b|\bbefore\s+(?:you\s+)?(?:checkout|check\sout|submit|complete|buy|purchase|proceed)\b|\bask(?:ing)?\s+(?:me|for)\b/i;

const CONDITIONAL_HITL_RE =
  /\bif\b[\s\S]{0,120}\b(?:subtotal|variance|price|cost|total)\b[\s\S]{0,120}\b(?:exceed|exceeds|exceeded|above|over|higher\s+than|greater\s+than|more\s+than|not\s+exceed)\b/i;

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
  // Complex multi-step goals must go through the LLM planner — the deterministic
  // fallback is only a fast path for trivial single-product orders.
  if (REQUIRES_LLM_RE.test(input.goal) || !looksLikeSimpleShoppingGoal(input.goal)) {
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
        kind: "navigate",
        description: "Open the storefront",
        params: { url: DEFAULT_STOREFRONT_URL },
      },
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
    estimatedSteps: 5,
  };
}

/**
 * Insert a pause_for_approval step into a plan when the goal asks for human
 * confirmation but the model omitted it. Placed right before the first checkout
 * (fill_form) step so the operator is brought into the loop before the commit.
 */
export function injectApprovalStep(plan: StepPlan[], goal: string): StepPlan[] {
  // Goals that already tie approval to a condition (for example, a subtotal
  // variance threshold) should not be forced into an unconditional pause. The
  // business-rule evaluator handles the actual threshold check.
  if (CONDITIONAL_HITL_RE.test(goal)) {
    return plan;
  }

  if (
    !REQUIRES_APPROVAL_RE.test(goal) ||
    plan.some((s) => s.kind === "pause_for_approval")
  ) {
    return plan;
  }
  const pauseStep: StepPlan = {
    kind: "pause_for_approval",
    description: "Pause and ask for human confirmation before checkout",
    params: {},
  };
  const beforeIndex = plan.findIndex((s) => s.kind === "fill_form");
  return beforeIndex === -1
    ? [...plan, pauseStep]
    : [...plan.slice(0, beforeIndex), pauseStep, ...plan.slice(beforeIndex)];
}

const SYSTEM_PROMPT = `You are a B2B procurement automation planner.
Given a natural-language procurement goal and business rules, decompose it into
an ordered list of concrete automation steps.

Each step must have:
- kind: one of navigate | search | extract_product | check_price | add_to_cart |
         apply_coupon | pause_for_approval | fill_form | validate | draft_report
- description: plain English description of this step
- params: an object with kind-specific keys (always include the PRODUCT NAME
  extracted from the goal — never generic placeholders like "milk" or "Almond Milk"):
  - search / extract_product: params.query / params.targetName = the exact product
    name from the goal (e.g. "Sauce Labs Backpack"). Do not invent a product that
    is not in the goal.
  - navigate: params.url when the goal names a specific storefront URL
  - add_to_cart / fill_form: params.quantity / params.fields when given

IMPORTANT — human approval:
- If the goal asks the agent to pause, confirm, get approval, or asks the user for
  confirmation before a high-stakes action (checkout, submitting, or completing an
  order), include a pause_for_approval step right before that action.
- The step order is re-ranked automatically, so just include the step — placement
  is handled for you.

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
              "pause_for_approval",
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
  pause_for_approval: 6,
  fill_form: 7,
  validate: 8,
  draft_report: 9,
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
  failureContext?: string,
  options?: { skipApprovalInjection?: boolean }
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
      let orderedPlan = [...plan].sort(
        (a, b) => (STEP_ORDER[a.kind] ?? 99) - (STEP_ORDER[b.kind] ?? 99)
      );
      const needsClarification =
        result.needsClarification === true || orderedPlan.length === 0;

      // Backstop: if the goal asked for human confirmation but the model omitted
      // the pause step, insert one before the first checkout step so the agent
      // always brings the operator into the loop before the high-stakes action.
      if (!options?.skipApprovalInjection) {
        orderedPlan = injectApprovalStep(orderedPlan, input.goal);
      }

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
