import { db, modelSettings } from "@bitebase/db";
import { eq, or } from "drizzle-orm";

/**
 * Effective model configuration resolved from multiple tiers:
 *
 *   1. DB row matching the given modelKey
 *   2. DB row with key `"default"` (catch-all)
 *   3. Env vars (`OLLAMA_TEMPERATURE`, `OLLAMA_MAX_TOKENS`, `OLLAMA_TOP_P`)
 *   4. Code defaults (built into each AI SDK call)
 *
 * Returns a flat config object that can be spread into any AI SDK call.
 */
export async function getEffectiveModelConfig(
  modelKey?: string,
): Promise<Record<string, unknown>> {
  const key = modelKey || process.env.OLLAMA_MODEL || "llama3.2";

  try {
    // Prefer exact key, fall back to "default" row.
    const rows = await db
      .select()
      .from(modelSettings)
      .where(
        or(eq(modelSettings.modelKey, key), eq(modelSettings.modelKey, "default")),
      )
      .limit(2);

    const exactRow = rows.find((r: { modelKey: string }) => r.modelKey === key);
    const defaultRow = rows.find((r: { modelKey: string }) => r.modelKey === "default");

    // Merge: exact row wins over default row, env vars fill in gaps.
    const dbConfig: Record<string, unknown> = {};

    if (defaultRow?.config && typeof defaultRow.config === "object") {
      Object.assign(dbConfig, defaultRow.config);
    }
    if (exactRow?.config && typeof exactRow.config === "object") {
      Object.assign(dbConfig, exactRow.config);
    }

    // Env var overrides for legacy keys
    if (process.env.OLLAMA_TEMPERATURE && dbConfig.temperature === undefined) {
      dbConfig.temperature = parseFloat(process.env.OLLAMA_TEMPERATURE);
    }
    if (process.env.OLLAMA_MAX_TOKENS && dbConfig.maxTokens === undefined) {
      dbConfig.maxTokens = parseInt(process.env.OLLAMA_MAX_TOKENS, 10);
    }
    if (process.env.OLLAMA_TOP_P && dbConfig.topP === undefined) {
      dbConfig.topP = parseFloat(process.env.OLLAMA_TOP_P);
    }

    return dbConfig;
  } catch {
    // DB not available — skip, caller falls back to code defaults.
    return {};
  }
}
