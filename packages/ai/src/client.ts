import { createOpenAI } from "@ai-sdk/openai";

export function createLocalAI() {
  return createOpenAI({
    baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1",
    apiKey: process.env.OLLAMA_API_KEY || "",
  });
}

export function getModel(modelId?: string) {
  const ai = createLocalAI();
  return ai(modelId ?? process.env.OLLAMA_MODEL ?? "llama3.2");
}

/**
 * Readable default model configuration from environment variables.
 *
 * Spread this object into every AI SDK call so that operators can tune
 * generation parameters without touching code. Per-call values (e.g.
 * explicit `temperature`) should come AFTER the spread so they win.
 *
 * Returns an empty object when no env vars are set — safe to always spread.
 */
export function getDefaultModelConfig(): {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
} {
  return {
    ...(process.env.OLLAMA_TEMPERATURE
      ? { temperature: parseFloat(process.env.OLLAMA_TEMPERATURE) }
      : {}),
    ...(process.env.OLLAMA_MAX_TOKENS
      ? { maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS, 10) }
      : {}),
    ...(process.env.OLLAMA_TOP_P
      ? { topP: parseFloat(process.env.OLLAMA_TOP_P) }
      : {}),
  };
}

// Module-level flag so we only warm up once per process.
let modelWarmedUp = false;

/**
 * Ensure the configured AI model is loaded into memory *before* the first
 * real inference request.
 *
 * LLM Studio in headless mode (`lms serve`) does NOT auto-load models on
 * the first API call — the request hangs or fails. This function:
 *
 *  1. Lists available models via GET /v1/models (best-effort).
 *  2. Sends a minimal 1-token chat completion to force model loading.
 *
 * Subsequent calls in the same process are no-ops.
 */
export async function ensureModelLoaded(): Promise<void> {
  if (modelWarmedUp) return;

  const modelId = process.env.OLLAMA_MODEL ?? "llama3.2";
  const baseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";

  console.log(`[ai] Ensuring model "${modelId}" is loaded…`);

  // 1. Check /v1/models (best-effort; many providers don't expose this)
  try {
    const res = await fetch(`${baseURL}/models`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        data?: Array<{ id: string }>;
      };
      const models = data?.data ?? [];
      const found = models.some((m) => m.id === modelId);
      if (found) {
        console.log(`[ai] Model "${modelId}" is registered`);
      } else {
        console.warn(
          `[ai] Model "${modelId}" not in /v1/models list`,
          models.length ? `(available: ${models.map((m) => m.id).join(", ")})` : "(empty list)",
        );
      }
    }
  } catch {
    // /v1/models is non-standard — skip silently.
  }

  // 2. Warm-up: send a minimal chat completion to trigger model loading.
  try {
    const warmRes = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 1,
        temperature: 0,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (warmRes.ok) {
      console.log(`[ai] Model "${modelId}" loaded successfully`);
    } else {
      const body = await warmRes.text().catch(() => "unknown");
      console.warn(
        `[ai] Model warm-up returned ${warmRes.status}: ${body.slice(0, 200)}`,
      );
    }
  } catch (err) {
    console.warn(
      `[ai] Model warm-up failed (proceeding anyway):`,
      err instanceof Error ? err.message : String(err),
    );
  }

  modelWarmedUp = true;
}
