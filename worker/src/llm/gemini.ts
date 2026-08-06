/**
 * worker/src/llm/gemini.ts
 *
 * Google Gemini 2.5 Flash adapter implementing the LLMProvider interface.
 * Uses the @google/generative-ai SDK with structured output (responseSchema).
 */

import {
  GoogleGenerativeAI,
  type GenerationConfig,
  type Content,
} from "@google/generative-ai";
import type { LLMProvider, LLMMessage, LLMGenerateOptions } from "./client.js";

const MODEL_NAME = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export class GeminiProvider implements LLMProvider {
  private readonly client: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generate(
    messages: LLMMessage[],
    options: LLMGenerateOptions = {}
  ): Promise<string> {
    const generationConfig: any = {
      temperature: options.temperature ?? 0.1,
      maxOutputTokens: options.maxTokens ?? 4096,
    };

    // If a JSON schema is provided, enable structured output
    if (options.responseSchema) {
      generationConfig.responseMimeType = "application/json";
      generationConfig.responseSchema = options.responseSchema;
    }

    // Split system instruction from conversation messages
    const systemMessage = messages.find((m) => m.role === "system");
    const conversationMessages = messages.filter((m) => m.role !== "system");

    const model = this.client.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemMessage?.content,
      generationConfig,
    });

    // Convert to Gemini Content format
    const history: Content[] = conversationMessages.slice(0, -1).map((m) => ({
      role: m.role === "model" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const lastMessage = conversationMessages.at(-1);
    if (!lastMessage) throw new Error("No messages to send");

    const chat = model.startChat({ history });
    const result = await chat.sendMessage(lastMessage.content);
    const response = result.response;
    return response.text();
  }
}
