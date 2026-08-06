/**
 * src/server/intent-classifier.ts
 *
 * Lightweight intent gatekeeper that runs before any run is enqueued. It decides
 * whether a prompt is a browser automation task, a question about capabilities,
 * or chitchat — so "hi" never launches a Playwright session.
 *
 * Primary classifier is a cheap Gemini Flash call (GEMINI_API_KEY). If the key is
 * missing or the call fails, a rule-based classifier covers the same three routes.
 */

import { z } from "zod";
import { UserIntentSchema, type UserIntent } from "./schemas";

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_CLASSIFY_TIMEOUT_MS = 10_000;

const GeminiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(z.object({ text: z.string() })),
        }),
      })
    )
    .min(1),
});

const GeminiClassificationSchema = z.object({
  intent: UserIntentSchema,
});

export class IntentClassifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntentClassifierError";
  }
}

export interface IntentClassifier {
  classify(message: string): Promise<UserIntent>;
}

// ---------------------------------------------------------------------------
// Rule-based fallback
// ---------------------------------------------------------------------------

const CAPABILITY_PATTERN =
  /(what (can|could|do) you (do|help)|how (can|could|do) you|what are you|who are you|capabil|help me|features|what do you do)/i;

const CHITCHAT_PATTERN =
  /^\s*(hi|hi+|hello+|hey+|yo+|hola|namaste|greetings)\b|good (morning|afternoon|evening)|what('| i)?s [\d+\-*/.]+\??$|my name is\b/i;

const TASK_HINTS =
  /(search|find|check|verify|compare|order|buy|cart|audit|reconcil|reorder|price|vendor|portal|storefront|discount|coupon|inventory|shipping|invoice|margin|extract|product|supplier)/i;

export class RuleBasedIntentClassifier implements IntentClassifier {
  async classify(message: string): Promise<UserIntent> {
    const text = message.trim();
    if (!text) return "CONVERSATIONAL";
    if (CAPABILITY_PATTERN.test(text)) return "CAPABILITY_QUERY";
    if (CHITCHAT_PATTERN.test(text)) return "CONVERSATIONAL";
    if (TASK_HINTS.test(text)) return "AUTOMATION_TASK";
    return "CONVERSATIONAL";
  }
}

// ---------------------------------------------------------------------------
// Gemini classifier
// ---------------------------------------------------------------------------

const CLASSIFY_SYSTEM_PROMPT = `You are the intent gatekeeper for Sentinel, a B2B procurement automation agent.
Classify the user's message into exactly one intent:
- AUTOMATION_TASK: a concrete browser task (search/order/compare/verify prices, build a cart, audit, reconcile, extract data from a storefront or vendor portal).
- CAPABILITY_QUERY: a question about what the agent can do or how it works.
- CONVERSATIONAL: greetings, chitchat, math, or anything unrelated to browser automation.

Respond with JSON only: {"intent": "<AUTOMATION_TASK|CAPABILITY_QUERY|CONVERSATIONAL>"}`;

function parseGeminiIntent(data: unknown): UserIntent {
  const parsed = GeminiResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new IntentClassifierError("Unexpected Gemini response shape");
  }

  const rawText = parsed.data.candidates[0].content.parts
    .map((part) => part.text)
    .join("")
    .replace(/^```(?:json)?|```$/g, "")
    .trim();

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawText);
  } catch {
    throw new IntentClassifierError("Gemini did not return valid JSON");
  }

  const classification = GeminiClassificationSchema.safeParse(decoded);
  if (!classification.success) {
    throw new IntentClassifierError("Gemini returned an unknown intent");
  }

  return classification.data.intent;
}

export class GeminiIntentClassifier implements IntentClassifier {
  constructor(private readonly apiKey?: string) {}

  async classify(message: string): Promise<UserIntent> {
    const apiKey = this.apiKey ?? process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new IntentClassifierError("GEMINI_API_KEY is not set");
    }

    const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
    const res = await fetch(`${GEMINI_API_URL}/${model}:generateContent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${CLASSIFY_SYSTEM_PROMPT}\n\nUser message: ${message}` },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(GEMINI_CLASSIFY_TIMEOUT_MS),
    });

    if (!res.ok) {
      throw new IntentClassifierError(`Gemini responded with ${res.status}`);
    }

    return parseGeminiIntent(await res.json());
  }
}

// ---------------------------------------------------------------------------
// Factory + fallback
// ---------------------------------------------------------------------------

export function createIntentClassifier(): IntentClassifier {
  if (process.env.GEMINI_API_KEY?.trim()) {
    return new GeminiIntentClassifier();
  }
  return new RuleBasedIntentClassifier();
}

export async function classifyIntent(message: string): Promise<UserIntent> {
  try {
    return await createIntentClassifier().classify(message);
  } catch {
    return new RuleBasedIntentClassifier().classify(message);
  }
}

// ---------------------------------------------------------------------------
// Replies & help content (server-side copy, returned by /api/intent)
// ---------------------------------------------------------------------------

export const CONVERSATIONAL_REPLIES = [
  "Hello! I can help you run browser tasks like ordering products, checking prices, or researching vendors. What would you like me to do?",
  "I'm a browser agent specialized in multi-step web tasks. Try giving me a goal like: \"Add 5 units of Organic Almond Milk to cart and check the price.\"",
  "Nice to meet you. Please give me a browser task when you're ready.",
];

const GREETING_PATTERN = /^\s*(hi+|hello+|hey+|yo+|hola|namaste|greetings)\b/i;

export function conversationalReply(message: string): string {
  if (GREETING_PATTERN.test(message)) {
    return CONVERSATIONAL_REPLIES[0];
  }
  const sum = [...message].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return CONVERSATIONAL_REPLIES[sum % CONVERSATIONAL_REPLIES.length];
}

export const CAPABILITY_HELP = {
  intro: "Here is what I can automate for you:",
  capabilities: [
    {
      title: "Search vendor portals",
      description: "Find specific product pricing across storefronts.",
      example:
        "Search the vendor portal for the unit price of Organic Almond Milk 1L.",
    },
    {
      title: "Compare actual vs target",
      description: "Compare real web prices against PO target prices and flag variance.",
      example:
        "Go to the vendor portal and verify unit price for Almond Milk 1L under $4.50.",
    },
    {
      title: "Pause for human approval",
      description: "Interrupt before high-stakes actions when variance exceeds your threshold.",
      example:
        "Compare the price of Oat Milk across 2 stores and flag any gap above 15%.",
    },
  ],
} as const;
