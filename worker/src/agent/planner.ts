/**
 * worker/src/agent/planner.ts
 *
 * LLM-powered goal parser: converts a natural-language GoalInput into
 * a structured StepPlan[] that the runner executes sequentially.
 */

import { getLLMProvider, parseModelJSON } from "../llm/client.js";
import type { GoalInput, StepPlan } from "../types/index.js";

const SYSTEM_PROMPT = `You are a B2B procurement automation planner.
Given a natural-language procurement goal and business rules, decompose it into
an ordered list of concrete automation steps.

Each step must have:
- kind: one of navigate | search | extract_product | check_price | add_to_cart |
         apply_coupon | fill_form | validate | draft_report
- description: plain English description of this step
- params: optional key-value pairs (e.g. url, query, field names, quantities)

If the goal is too vague to act on — for example it does not name a product,
a quantity, or an action — return an EMPTY array []. Do not invent products,
quantities, or URLs. Do not return placeholder or "validate only" plans.

Output ONLY a valid JSON array of step objects. No prose, no markdown.`;

const STEP_SCHEMA = {
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
    required: ["kind", "description"],
  },
};

/**
 * Parse a GoalInput into a StepPlan[] using the LLM.
 */
export async function planGoal(input: GoalInput): Promise<StepPlan[]> {
  const llm = getLLMProvider();

  const userPrompt = `
Procurement goal: ${input.goal}

Business rules:
- Target unit price: ${input.targetUnitPrice != null ? `$${input.targetUnitPrice}` : "not set"}
- Variance threshold: ${input.varianceThresholdPct}%
- Discount code: ${input.discountCode ?? "none"}
- Fallback policy: ${input.fallbackPolicy}

Generate the step plan.`.trim();

  const text = await llm.generate(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { responseSchema: STEP_SCHEMA, temperature: 0.1 }
  );

  const steps = parseModelJSON<StepPlan[]>(text);

  if (!Array.isArray(steps)) {
    throw new Error("Planner returned non-array response");
  }

  return steps;
}
