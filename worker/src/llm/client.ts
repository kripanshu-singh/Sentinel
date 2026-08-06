/**
 * worker/src/llm/client.ts
 *
 * LLM provider interface and factory.
 * The agent never calls Gemini or OpenRouter directly — it calls this interface.
 * Switching providers or adding fallback logic stays contained here.
 */

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface LLMMessage {
  role: "user" | "model" | "system";
  content: string;
}

export interface LLMGenerateOptions {
  /** JSON schema the model must conform to (structured output) */
  responseSchema?: object;
  /** Max tokens to generate */
  maxTokens?: number;
  /** 0–1 temperature */
  temperature?: number;
}

export interface LLMProvider {
  /**
   * Generate a single response. Returns the text content of the model's reply.
   * If `responseSchema` is set, the response is guaranteed to be valid JSON
   * matching the schema (or an error is thrown).
   */
  generate(
    messages: LLMMessage[],
    options?: LLMGenerateOptions
  ): Promise<string>;
}

// ---------------------------------------------------------------------------
// Factory — picks primary (Gemini) then falls back to OpenRouter
// ---------------------------------------------------------------------------

let _provider: LLMProvider | null = null;

export function getLLMProvider(): LLMProvider {
  if (_provider) return _provider;

  if (process.env.GEMINI_API_KEY) {
    // Lazy import to avoid loading the SDK if not needed
    const { GeminiProvider } = require("./gemini.js") as {
      GeminiProvider: new () => LLMProvider;
    };
    _provider = new GeminiProvider();
    console.log("[llm] using Gemini provider");
  } else if (process.env.OPENROUTER_API_KEY) {
    const { OpenRouterProvider } = require("./openrouter.js") as {
      OpenRouterProvider: new () => LLMProvider;
    };
    _provider = new OpenRouterProvider();
    console.log("[llm] using OpenRouter provider");
  } else {
    throw new Error(
      "No LLM provider configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY in .env"
    );
  }

  return _provider;
}

// ---------------------------------------------------------------------------
// Convenience: parse JSON from model output robustly
// ---------------------------------------------------------------------------

/**
 * Parse JSON from the model's text output.
 * Strips markdown code fences if the model wraps the JSON in ```json … ```.
 * On failure, makes a best-effort repair for truncated output (unclosed
 * brackets/braces) before giving up — the caller usually retries.
 */
export function parseModelJSON<T = unknown>(text: string): T {
  // Strip optional markdown fences
  const stripped = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(stripped) as T;
  } catch {
    const repaired = closeDelimiters(stripped);
    if (repaired !== stripped) {
      return JSON.parse(repaired) as T;
    }
    throw new SyntaxError(`Invalid JSON from model: ${text.slice(0, 200)}`);
  }
}

/**
 * Append the closing delimiters needed to make truncated JSON parseable.
 * Returns the input unchanged if a string is unterminated (unrepairable).
 */
function closeDelimiters(input: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;

  for (const char of input) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") stack.push("}");
    else if (char === "[") stack.push("]");
    else if (char === "}" || char === "]") stack.pop();
  }

  if (inString) return input;
  return input + stack.reverse().join("");
}
