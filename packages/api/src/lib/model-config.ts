import { db, modelSettings } from "@bitebase/db";
import { eq } from "drizzle-orm";

/**
 * Effective model configuration resolved from three tiers:
 *
 *   1. DB settings  (admin UI — overrides everything when set)
 *   2. Env var       (startup-time configuration)
 *   3. Code default  (only returned when neither DB nor env var is set)
 *
 * Returns the config keys the caller can spread into any AI SDK call.
 */
export interface EffectiveModelConfig {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export async function getEffectiveModelConfig(): Promise<EffectiveModelConfig> {
  const config: EffectiveModelConfig = {};

  try {
    const row = await db
      .select()
      .from(modelSettings)
      .where(eq(modelSettings.id, "default"))
      .limit(1)
      .then((rows) => rows[0] ?? null);

    // Resolve each key: DB → env var → leave undefined
    if (row?.temperature != null) {
      config.temperature = row.temperature;
    } else if (process.env.OLLAMA_TEMPERATURE) {
      config.temperature = parseFloat(process.env.OLLAMA_TEMPERATURE);
    }

    if (row?.maxTokens != null) {
      config.maxTokens = row.maxTokens;
    } else if (process.env.OLLAMA_MAX_TOKENS) {
      config.maxTokens = parseInt(process.env.OLLAMA_MAX_TOKENS, 10);
    }

    if (row?.topP != null) {
      config.topP = row.topP;
    } else if (process.env.OLLAMA_TOP_P) {
      config.topP = parseFloat(process.env.OLLAMA_TOP_P);
    }
  } catch {
    // DB not available — skip, caller falls back to code defaults
  }

  return config;
}
