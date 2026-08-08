/**
 * worker/src/agent/planner.ts
 *
 * LLM-powered goal parser: converts a natural-language GoalInput into a rich
 * PlanResult — a normalized goal, an ordered StepPlan[], and metadata
 * (risk, confidence, clarification flag) that the UI can surface later.
 */

import { getLLMProvider, parseModelJSON, type LLMMessage } from "../llm/client.js";
import { extractQuantityForProduct } from "../lib/goal-rules.js";
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

// A goal that carries a numeric budget / subtotal ceiling ("budget is $5",
// "subtotal under $50") is a CONDITIONAL approval: the rule engine evaluates it
// and pauses with concrete expected/actual numbers. Injecting a bare
// pause_for_approval on top of it produces a detail-free "just confirm?" gate.
const BUDGET_RE =
  /\b(?:budget|subtotal|total|combined)\b[\s\S]{0,40}?\$?\s*\d+(?:\.\d{1,2})?/i;

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

export function extractCleanProductName(goal: string): string {
  let cleaned = goal.trim();

  // Strip conversational budget/target prefixes (e.g. "So my target price is $20 and please search...")
  cleaned = cleaned.replace(/^(?:so\s+)?(?:my\s+)?(?:target\s+)?(?:price|budget)\s+is\s*\$?\d+(?:\.\d+)?\s*(?:and\s+)?(?:so\s+)?(?:please\s+)?/i, "");
  cleaned = cleaned.replace(/^(?:so\s+|please\s+|can\s+you\s+|could\s+you\s+)+/i, "");

  // Strip shopping action verbs
  cleaned = cleaned.replace(/^(?:add|buy|purchase|order|search|find|look for|pick|select|grab|get|tell me|verify)\s+/i, "");

  // Strip price noun prefixes (e.g. "the price of", "cost for")
  cleaned = cleaned.replace(/^(?:the|a|an)\s+(?:price|cost|rate|stock|availability)\s+(?:of|for)?\s*/i, "");
  cleaned = cleaned.replace(/^(?:price|cost|rate)\s+(?:of|for)?\s*/i, "");

  // Strip storefront suffixes (e.g. "on PS5 store", "from Amazon", "on eBay")
  cleaned = cleaned.replace(/\s+(?:on|at|from)\s+(?:ebay|amazon|flipkart|walmart|myntra|ajio|bestbuy|ps5\s*store|playstation\s*store|saucedemo|sauce\s*demo|[a-z0-9-]+\.[a-z]{2,})\b.*$/i, "");

  // Strip price/budget suffixes (e.g. "game price for PS5", "under $50")
  cleaned = cleaned.replace(/\s+(?:price|cost)\s+for\b/i, " for");
  cleaned = cleaned.replace(/\s+(?:under|up to|below|at most|max|less than|for|with|in|from)\b.*$/i, "");
  cleaned = cleaned.replace(/^(?:the|a|an)\s+/i, "");

  return cleaned.trim() || goal.trim();
}

export function resolveStorefrontUrl(goal: string, inputUrl?: string): string | undefined {
  if (inputUrl && inputUrl.trim()) {
    return inputUrl.trim();
  }

  // Check for explicit HTTP/HTTPS URLs in goal text
  const urlMatch = goal.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    return urlMatch[0];
  }

  // Extract clean query/product name for direct search URLs
  const query = extractCleanProductName(goal);
  const encodedQuery = encodeURIComponent(query || "product");

  // Map common storefront names mentioned in goal to direct search URLs
  if (/\bebay\b/i.test(goal)) return `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}`;
  if (/\bamazon\b/i.test(goal)) return `https://www.amazon.com/s?k=${encodedQuery}`;
  if (/\bflipkart\b/i.test(goal)) return `https://www.flipkart.com/search?q=${encodedQuery}`;
  if (/\bwalmart\b/i.test(goal)) return `https://www.walmart.com/search?q=${encodedQuery}`;
  if (/\bmyntra\b/i.test(goal)) return `https://www.myntra.com/${encodedQuery}`;
  if (/\bajio\b/i.test(goal)) return `https://www.ajio.com/search/?text=${encodedQuery}`;
  if (/\bbestbuy\b/i.test(goal)) return `https://www.bestbuy.com/site/searchpage.jsp?st=${encodedQuery}`;
  if (/\bsauce\s*demo\b|\bsaucedemo\b/i.test(goal)) return "https://www.saucedemo.com/";

  // Default fallback for generic product goals without a specified storefront:
  // use eBay direct search URL (fast, public, low bot risk) instead of SauceDemo.
  return `https://www.ebay.com/sch/i.html?_nkw=${encodedQuery}`;
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

  const productName = extractCleanProductName(input.goal);

  const storefrontUrl = resolveStorefrontUrl(input.goal, input.storefrontUrl);
  const isDirectSearchUrl = Boolean(storefrontUrl && /[?&](?:_nkw|k|q|st)=/i.test(storefrontUrl));

  const navigateSteps: StepPlan[] = storefrontUrl
    ? [
        {
          kind: "navigate",
          description: isDirectSearchUrl
            ? `Navigate to search results for ${productName}`
            : `Open the storefront`,
          params: { url: storefrontUrl },
        },
      ]
    : [];

  const searchSteps: StepPlan[] = isDirectSearchUrl
    ? []
    : [
        {
          kind: "search",
          description: `Search for ${productName}`,
          params: { query: productName },
        },
      ];

  const isReadOnlyCheck =
    /\b(find|check|verify|get|what\s+is|show|search|tell\s+me|look\s+for)\b/i.test(input.goal) &&
    /\b(price|cost|rate|stock|availability|spec|specs|details)\b/i.test(input.goal) &&
    !/\b(add\s+to\s+cart|buy|purchase|order|checkout|procure)\b/i.test(input.goal);

  const cartSteps: StepPlan[] = isReadOnlyCheck
    ? []
    : [
        {
          kind: "add_to_cart",
          description: `Add ${productName} to the cart`,
          params: { quantity: 1 },
        },
      ];

  const planSteps: StepPlan[] = [
    ...navigateSteps,
    ...searchSteps,
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
    ...cartSteps,
  ];

  return {
    goal: `Find and add ${productName} to the cart`
      .replace(/\s+/g, " ")
      .trim(),
    plan: planSteps,
    needsClarification: false,
    risk: "low",
    confidence: 0.85,
    estimatedSteps: planSteps.length,
  };
}

/**
 * Insert a pause_for_approval step into a plan when the goal asks for human
 * confirmation but the model omitted it. Placed right before the first checkout
 * (fill_form) step so the operator is brought into the loop before the commit.
 */
export function injectApprovalStep(plan: StepPlan[], goal: string): StepPlan[] {
  // Goals that already tie approval to a condition (a subtotal variance
  // threshold, or any numeric budget ceiling) should not be forced into an
  // unconditional pause. The business-rule evaluator handles the actual check.
  if (CONDITIONAL_HITL_RE.test(goal) || BUDGET_RE.test(goal)) {
    return plan.filter((step) => step.kind !== "pause_for_approval");
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

/**
 * Ensure every add_to_cart step carries a concrete per-product quantity. The LLM
 * prompt asks for it, but this backstop derives it from the goal ("5 units of X")
 * so multi-product runs never drop a quantity the operator explicitly requested.
 */
export function backfillQuantities(plan: StepPlan[], goal: string): StepPlan[] {
  return plan.map((step) => {
    if (step.kind !== "add_to_cart") return step;
    if (typeof step.params?.quantity === "number") return step;
    const productName =
      (step.params?.targetName as string | undefined) ??
      (step.params?.query as string | undefined);
    const qty = extractQuantityForProduct(goal, productName);
    return { ...step, params: { ...step.params, quantity: qty } };
  });
}

/**
 * Backstop for a resilient report: guarantee the final reconciliation report is
 * drafted (and that a combined-subtotal goal actually gets a subtotal gate
 * evaluated) even if the LLM planner omitted these steps.
 */
export function ensureTerminalSteps(plan: StepPlan[], input: GoalInput): StepPlan[] {
  const next = [...plan];
  const hasValidate = next.some((s) => s.kind === "validate");
  const hasDraft = next.some((s) => s.kind === "draft_report");

  if (input.targetSubtotal !== undefined && !hasValidate) {
    next.push({ kind: "validate", description: "Validate the combined cart subtotal against the target", params: {} });
  }
  if (!hasDraft) {
    next.push({ kind: "draft_report", description: "Draft the final reconciliation report", params: {} });
  }

  // The combined-subtotal gate MUST run before the terminal report draft.
  // `draft_report` routes straight to the report node (END), so if the validate
  // step ended up after it the budget would never be checked. Order them.
  const validateIdx = next.findIndex((s) => s.kind === "validate");
  const draftIdx = next.findIndex((s) => s.kind === "draft_report");
  if (validateIdx !== -1 && draftIdx !== -1 && validateIdx > draftIdx) {
    const [validateStep] = next.splice(validateIdx, 1);
    next.splice(draftIdx, 0, validateStep);
  }

  return next;
}

const SYSTEM_PROMPT = `You are a B2B procurement automation planner.
Given a natural-language procurement goal and business rules, decompose it into
an ordered list of concrete automation steps.

Each step must have:
- kind: one of navigate | search | extract_product | check_price | add_to_cart |
         apply_coupon | pause_for_approval | fill_form | validate | draft_report
- description: plain English description of this step
- params: an object with kind-specific keys. ALWAYS include the target product name
  in every product-specific step — never use generic placeholders:
  - search:          params.query     = exact product name from the goal
  - extract_product: params.targetName = exact product name from the goal
  - check_price:     params.targetName = exact product name from the goal
  - add_to_cart:     params.targetName = exact product name from the goal
                     params.quantity  = quantity (default 1)
  - navigate:        params.url MUST always be a DIRECT SEARCH RESULTS URL — never
                     the homepage. This skips the search step entirely and is faster
                     and more reliable. Use these URL templates:

                     eBay:     https://www.ebay.com/sch/i.html?_nkw={query}
                     Amazon:   https://www.amazon.com/s?k={query}
                     Flipkart: https://www.flipkart.com/search?q={query}
                     Walmart:  https://www.walmart.com/search?q={query}
                     BestBuy:  https://www.bestbuy.com/site/searchpage.jsp?st={query}

                     Replace {query} with the URL-encoded product name.
                     Examples (product = "Sony WH-1000XM5"):
                       - eBay     → "https://www.ebay.com/sch/i.html?_nkw=Sony+WH-1000XM5"
                       - Amazon   → "https://www.amazon.com/s?k=Sony+WH-1000XM5"
                       - Flipkart → "https://www.flipkart.com/search?q=Sony+WH-1000XM5"

                     If the storefrontUrl is already a search-results URL (contains
                     "search", "sch", "/s?", etc.) use it verbatim.
                     If you don't know the search URL pattern, use the storefront
                     homepage as fallback (not preferred).

                     CRITICAL: When you use a direct search URL navigate step, DO NOT
                     also emit a separate "search" step — the navigation already lands
                     on search results. Only emit a search step if the navigate goes to
                     a homepage and a search box interaction is needed.
  - fill_form:       params.fields when given

IMPORTANT — navigate step:
- ALWAYS emit a navigate step as the first step.
- ALWAYS use a direct search results URL when you know the storefront's search URL
  pattern. This is faster, more reliable, and avoids the homepage entirely.
- The navigate step's params.url must be derived from:
  1. The "storefrontUrl" field in the business rules (use as-is if it's already a
     search URL; append the search query if it's a homepage)
  2. Any URL explicitly mentioned in the goal (same logic)
  3. The storefront name in the goal → map to search URL using templates above
  4. If none of the above — use "https://www.saucedemo.com/" ONLY as a last
     resort for demo/test scenarios.

IMPORTANT — search step:
- ONLY emit a search step when the navigate step goes to a homepage and you
  need to interact with a search box.
- If the navigate step already goes to a search-results URL, SKIP the search step.

IMPORTANT — multi-product goals:
- If the goal mentions TWO OR MORE products, emit a COMPLETE set of steps for
  EACH product: search → extract_product → check_price → add_to_cart.
  Do NOT skip any product. Do NOT merge steps from different products.
- The targetName / query param on every step MUST match the exact product name
  from the goal — this is how the agent knows WHICH item to interact with.

IMPORTANT — read-only check vs purchasing:
- If the goal is ONLY to check, find, verify, or extract a price or stock (e.g. "Find the price of X", "Check if Y is under $50", "Verify price of Z"), DO NOT emit add_to_cart, fill_form, or pause_for_approval steps. End the plan at check_price → draft_report.
- ONLY emit add_to_cart, fill_form, or checkout steps when the goal explicitly asks to buy, order, add to cart, or procure a product.

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
          params: {
            type: "object",
            properties: {
              url: { type: "string" },
              query: { type: "string" },
              targetName: { type: "string" },
              quantity: { type: "integer" },
            },
          },
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

export function orderPlanSteps(plan: StepPlan[]): StepPlan[] {
  const preSteps: StepPlan[] = [];
  const postSteps: StepPlan[] = [];
  const productGroups: { [product: string]: StepPlan[] } = {};
  const productOrder: string[] = [];

  // Product-specific step kinds — everything else is pre/post
  const PRODUCT_SPECIFIC_KINDS = new Set([
    "search", "extract_product", "check_price", "add_to_cart", "apply_coupon",
  ]);

  let lastProduct: string | null = null;

  for (const step of plan) {
    // Prefer explicit targetName, then query — add_to_cart should now always
    // carry targetName after the system prompt fix.
    const paramProduct = (
      (step.params?.targetName as string | undefined) ??
      (step.params?.query as string | undefined)
    );
    if (paramProduct) {
      lastProduct = paramProduct;
    }

    const isProductSpecific = PRODUCT_SPECIFIC_KINDS.has(step.kind);

    if (isProductSpecific) {
      // Use the param name directly if present; otherwise fall back to the
      // last seen product so orphaned steps (missing params) stay with the
      // correct product group.
      const prod = paramProduct ?? lastProduct ?? "unknown";
      if (!productGroups[prod]) {
        productGroups[prod] = [];
        productOrder.push(prod);
      }
      productGroups[prod].push(step);
    } else if (step.kind === "navigate") {
      preSteps.push(step);
    } else {
      postSteps.push(step);
    }
  }

  const orderedProducts: StepPlan[] = [];
  for (const prod of productOrder) {
    const sortedGroup = [...productGroups[prod]].sort(
      (a, b) => (STEP_ORDER[a.kind] ?? 99) - (STEP_ORDER[b.kind] ?? 99)
    );
    orderedProducts.push(...sortedGroup);
  }

  const sortedPre = [...preSteps].sort((a, b) => (STEP_ORDER[a.kind] ?? 99) - (STEP_ORDER[b.kind] ?? 99));
  const sortedPost = [...postSteps].sort((a, b) => (STEP_ORDER[a.kind] ?? 99) - (STEP_ORDER[b.kind] ?? 99));

  return [...sortedPre, ...orderedProducts, ...sortedPost];
}

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
- Storefront URL: ${input.storefrontUrl ?? "not set — derive from goal or storefront name"}
- Target unit price: ${input.targetUnitPrice != null ? `$${input.targetUnitPrice}` : "not set"}
- Target cart subtotal (combined): ${input.targetSubtotal != null ? `$${input.targetSubtotal}` : "not set"}
- Variance threshold: ${input.varianceThresholdPct}%
- Discount code: ${input.discountCode ?? "none"}
- Fallback policy: ${input.fallbackPolicy}
${failureContext
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
      let orderedPlan = orderPlanSteps(plan);
      const needsClarification =
        result.needsClarification === true || orderedPlan.length === 0;

      // Backstop: if the goal asked for human confirmation but the model omitted
      // the pause step, insert one before the first checkout step so the agent
      // always brings the operator into the loop before the high-stakes action.
      if (!options?.skipApprovalInjection) {
        orderedPlan = injectApprovalStep(orderedPlan, input.goal);
      }

      // A goal with a numeric budget is a CONDITIONAL approval the validator
      // evaluates with real expected/actual numbers. A bare pause_for_approval
      // (whether the LLM emitted it or one slipped past injection) would open a
      // detail-free gate instead. Drop it — the subtotal catch feeds the HITL.
      if (input.targetSubtotal !== undefined) {
        orderedPlan = orderedPlan.filter((s) => s.kind !== "pause_for_approval");
      }

      // Resilience backstops: concrete quantities + a guaranteed report draft
      // (and subtotal gate when a combined-subtotal goal needs one).
      orderedPlan = backfillQuantities(orderedPlan, input.goal);
      orderedPlan = ensureTerminalSteps(orderedPlan, input);

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
