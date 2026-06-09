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
 * the first API call — the request fails with "No models loaded". This function:
 *
 *  1. Lists available models via GET /api/v1/models (LLM Studio endpoint).
 *  2. If none are loaded, POSTs to /api/v1/models/load to trigger loading.
 *
 * Subsequent calls in the same process are no-ops.
 */
export async function ensureModelLoaded(): Promise<void> {
  if (modelWarmedUp) return;

  const ollamaBaseURL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";

  console.log(`[ai] Ensuring AI model is loaded…`);

  // Only apply to LLM Studio — Ollama auto-loads on first request.
  // Detect by checking if the base URL targets LLM Studio's default port.
  const isLLMStudio = ollamaBaseURL.includes("1234");
  if (!isLLMStudio) {
    console.log(`[ai] Running against Ollama (${ollamaBaseURL}), model warm-up is handled by the server`);
    modelWarmedUp = true;
    return;
  }

  // Derive the LLM Studio management API origin from the OpenAI-compatible base URL.
  //   OLLAMA_BASE_URL = http://localhost:1234/v1
  //   management root  = http://localhost:1234/api/v1
  const origin = ollamaBaseURL.replace(/\/v1\/?$/, "");

  // Step 1: Check whether any models are currently loaded.
  try {
    const res = await fetch(`${origin}/api/v1/models`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      console.warn(`[ai] Failed to list LLM Studio models (${res.status}), skipping load`);
      modelWarmedUp = true;
      return;
    }

    const body = (await res.json()) as {
      models: Array<{ type?: string; key: string; loaded_instances?: unknown[] }>;
    };
    const models = body.models ?? [];
    const totalLoaded = models.reduce(
      (sum, m) => sum + (Array.isArray(m.loaded_instances) ? (m.loaded_instances.length as number) : 0),
      0,
    );

    if (totalLoaded > 0) {
      console.log(`[ai] ${totalLoaded} model(s) already loaded in LLM Studio`);
      modelWarmedUp = true;
      return;
    }

    // Step 2: Find an unloaded LLM model and load it.
    const candidate = models.find(
      (m) => m.type === "llm" && Array.isArray(m.loaded_instances) && m.loaded_instances.length === 0,
    );

    if (!candidate) {
      console.warn(`[ai] No unloaded LLM models found in LLM Studio`);
      modelWarmedUp = true;
      return;
    }

    console.log(`[ai] Loading "${candidate.key}" via /api/v1/models/load…`);

    const loadRes = await fetch(`${origin}/api/v1/models/load`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: candidate.key }),
      signal: AbortSignal.timeout(300_000), // models can take a while to load
    });

    if (loadRes.ok) {
      console.log(`[ai] Model "${candidate.key}" loaded successfully`);
    } else {
      const errBody = await loadRes.text().catch(() => "unknown");
      console.warn(`[ai] Model load returned ${loadRes.status}: ${errBody.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn(
      `[ai] Model load check failed (${err instanceof Error ? err.message : String(err)}), skipping warm-up`,
    );
  }

  modelWarmedUp = true;
}
