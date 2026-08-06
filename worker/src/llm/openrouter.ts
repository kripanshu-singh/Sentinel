/**
 * worker/src/llm/openrouter.ts
 *
 * OpenRouter fallback adapter (OpenAI-compatible API).
 * Used when GEMINI_API_KEY is not set but OPENROUTER_API_KEY is.
 */

import OpenAI from "openai";
import type { LLMProvider, LLMMessage, LLMGenerateOptions } from "./client.js";

const MODEL_NAME =
  process.env.OPENROUTER_MODEL ?? "google/gemini-3.5-flash-lite";

export class OpenRouterProvider implements LLMProvider {
  private readonly client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");
    this.client = new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": "https://sentinel.app",
        "X-Title": "Sentinel B2B Agent",
      },
    });
  }

  async generate(
    messages: LLMMessage[],
    options: LLMGenerateOptions = {}
  ): Promise<string> {
    const openAiMessages = messages.map((m) => ({
      role: m.role === "model" ? ("assistant" as const) : m.role,
      content: m.content,
    }));

    const requestParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: MODEL_NAME,
      messages: openAiMessages,
      temperature: options.temperature ?? 0.1,
      max_tokens: options.maxTokens ?? 4096,
    };

    // Request JSON output if a schema is provided
    if (options.responseSchema) {
      requestParams.response_format = { type: "json_object" };
    }

    const completion = await this.client.chat.completions.create(requestParams);
    return completion.choices[0]?.message?.content ?? "";
  }
}
