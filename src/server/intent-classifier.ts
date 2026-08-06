/**
 * src/server/intent-classifier.ts
 *
 * Lightweight intent gatekeeper that runs before any run is enqueued. It decides
 * whether a prompt is a browser automation task, a question about capabilities,
 * or chitchat — so "hi" never launches a Playwright session.
 *
 * Conversational turns are answered from the current session's history. The
 * conversation is owned by the browser tab and sent with each request; nothing is
 * persisted server-side and history never crosses into a task run.
 *
 * Primary classifier is a cheap Gemini Flash call (GEMINI_API_KEY). If the key is
 * missing or the call fails, a rule-based classifier covers the same routes and
 * answers simple session questions (e.g. a name given earlier in the thread).
 */

import { z } from "zod";
import {
  UserIntentSchema,
  type UserIntent,
  type ConversationTurn,
} from "./schemas";

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

const GeminiDecisionSchema = z.object({
  intent: UserIntentSchema,
  reply: z.string().nullable().optional(),
});

export interface IntentDecision {
  intent: UserIntent;
  reply?: string;
}

export class IntentClassifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IntentClassifierError";
  }
}

export interface IntentClassifier {
  route(message: string, history: ConversationTurn[]): Promise<IntentDecision>;
}

// ---------------------------------------------------------------------------
// Rule-based fallback
// ---------------------------------------------------------------------------

const CAPABILITY_PATTERN =
  /(what (can|could|do) you (do|help)|how (can|could|do) you|what are you|who are you|capabil|help me|features|what do you do)/i;

const CHITCHAT_PATTERN =
  /^\s*(hi|hi+|hello+|hey+|yo+|hola|namaste|greetings)\b|good (morning|afternoon|evening)|what('| i)?s [\d+\-*/.]+\??$|what('| i)?s my name\??$/i;

const TASK_HINTS =
  /(search|find|check|verify|compare|order|buy|cart|audit|reconcil|reorder|price|vendor|portal|storefront|discount|coupon|inventory|shipping|invoice|margin|extract|product|supplier)/i;

const GREETING_PATTERN = /^\s*(hi+|hello+|hey+|yo+|hola|namaste|greetings)\b/i;

const NAME_QUESTION_PATTERN = /what('| i)?s my name\??$/i;

const NAME_EXTRACTION_PATTERNS = [
  /i'm\s+([a-z][a-z '-]*)/i,
  /i am\s+([a-z][a-z '-]*)/i,
  /my name is\s+([a-z][a-z '-]*)/i,
];

function rememberName(
  message: string,
  history: ConversationTurn[]
): string | undefined {
  const texts = [message, ...history.filter((t) => t.role === "user").map((t) => t.content)];
  for (const text of texts) {
    for (const pattern of NAME_EXTRACTION_PATTERNS) {
      const match = pattern.exec(text);
      if (match) return match[1].trim();
    }
  }
  return undefined;
}

export class RuleBasedIntentClassifier implements IntentClassifier {
  async route(
    message: string,
    history: ConversationTurn[]
  ): Promise<IntentDecision> {
    const text = message.trim();
    if (!text) {
      return { intent: "CONVERSATIONAL", reply: CONVERSATIONAL_REPLIES[0] };
    }

    let intent: UserIntent;
    if (CAPABILITY_PATTERN.test(text)) {
      intent = "CAPABILITY_QUERY";
    } else if (CHITCHAT_PATTERN.test(text)) {
      intent = "CONVERSATIONAL";
    } else if (TASK_HINTS.test(text)) {
      intent = "AUTOMATION_TASK";
    } else {
      intent = "CONVERSATIONAL";
    }

    if (intent !== "CONVERSATIONAL") {
      return { intent };
    }
    return { intent, reply: ruleBasedReply(text, history) };
  }
}

function ruleBasedReply(message: string, history: ConversationTurn[]): string {
  if (NAME_QUESTION_PATTERN.test(message)) {
    const name = rememberName(message, history);
    if (name) {
      return `Your name is ${name}. What would you like me to automate?`;
    }
  }
  if (GREETING_PATTERN.test(message)) {
    return CONVERSATIONAL_REPLIES[0];
  }
  const sum = [...message].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return CONVERSATIONAL_REPLIES[sum % CONVERSATIONAL_REPLIES.length];
}

// ---------------------------------------------------------------------------
// Gemini classifier
// ---------------------------------------------------------------------------

const CLASSIFY_SYSTEM_PROMPT = `You are Sentinel, a B2B procurement automation agent.
A short conversation for THIS session is provided; use it to answer personal follow-ups (for example, if the user says "I'm Kripanshu" and later asks "what's my name?", you must answer Kripanshu — never claim to not know).

Classify the user's latest message into exactly one intent:
- AUTOMATION_TASK: a concrete browser task (search/order/compare/verify prices, build a cart, audit, reconcile, extract data from a storefront or vendor portal).
- CAPABILITY_QUERY: a question about what the agent can do or how it works.
- CONVERSATIONAL: greetings, chitchat, small talk, math, or questions about the user or this conversation.

For CONVERSATIONAL, reply briefly (max 2 sentences), grounded in the conversation history.
For the other two, set "reply" to null.

Respond with JSON only: {"intent": "<AUTOMATION_TASK|CAPABILITY_QUERY|CONVERSATIONAL>", "reply": "<text or null>"}`;

function formatHistory(history: ConversationTurn[]): string {
  if (history.length === 0) return "(none)";
  return history.map((turn) => `${turn.role}: ${turn.content}`).join("\n");
}

function parseGeminiDecision(data: unknown): IntentDecision {
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

  const decision = GeminiDecisionSchema.safeParse(decoded);
  if (!decision.success) {
    throw new IntentClassifierError("Gemini returned an unknown intent");
  }

  if (decision.data.intent === "CONVERSATIONAL" && !decision.data.reply) {
    throw new IntentClassifierError("Gemini did not provide a conversational reply");
  }

  return {
    intent: decision.data.intent,
    reply: decision.data.reply ?? undefined,
  };
}

export class GeminiIntentClassifier implements IntentClassifier {
  constructor(private readonly apiKey?: string) {}

  async route(
    message: string,
    history: ConversationTurn[]
  ): Promise<IntentDecision> {
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
              {
                text: `${CLASSIFY_SYSTEM_PROMPT}\n\nConversation so far:\n${formatHistory(
                  history
                )}\n\nUser message: ${message}`,
              },
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

    return parseGeminiDecision(await res.json());
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

export async function routeIntent(
  message: string,
  history: ConversationTurn[]
): Promise<IntentDecision> {
  try {
    return await createIntentClassifier().route(message, history);
  } catch {
    return new RuleBasedIntentClassifier().route(message, history);
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
