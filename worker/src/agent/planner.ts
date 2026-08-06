/**
 * worker/src/agent/planner.ts
 *
 * LLM-powered goal parser: converts a natural-language GoalInput into a rich
 * PlanResult — a normalized goal, an ordered StepPlan[], and metadata
 * (risk, confidence, clarification flag) that the UI can surface later.
 */

import { getLLMProvider, parseModelJSON } from "../llm/client.js";
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

const SYSTEM_PROMPT = `You are a B2B procurement automation planner.
Given a natural-language procurement goal and business rules, decompose it into
an ordered list of concrete automation steps.

Each step must have:
- kind: one of navigate | search | extract_product | check_price | add_to_cart |
         apply_coupon | fill_form | validate | draft_report
- description: plain English description of this step
- params: optional key-value pairs (e.g. url, query, field names, quantities)

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
        required: ["kind", "description"],
      },
    },
  },
  required: ["goal", "plan", "needsClarification", "risk", "confidence", "estimatedSteps"],
};

/**
 * Parse a GoalInput into a PlanResult using the LLM.
 */
export async function planGoal(input: GoalInput): Promise<PlanResult> {
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
    { responseSchema: PLAN_SCHEMA, temperature: 0.1 }
  );

  const result = parseModelJSON<Partial<PlanResult>>(text);

  const plan = Array.isArray(result.plan) ? result.plan : [];
  const needsClarification =
    result.needsClarification === true || plan.length === 0;

  return {
    goal: typeof result.goal === "string" ? result.goal : input.goal,
    plan,
    needsClarification,
    risk: result.risk ?? "low",
    confidence: typeof result.confidence === "number" ? result.confidence : 0.5,
    estimatedSteps: plan.length,
  };
}
