import {
  pgTable,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

/**
 * Per-model runtime configuration.
 *
 * Each row stores a free-form JSON config object keyed by model identifier
 * (e.g. `"llama3.2"`, `"llama-3.2-3b-instruct"`, `"default"`).
 *
 * Resolution hierarchy when looking up a config:
 *   1. Row matching the active model key
 *   2. Row with key `"default"` (catch-all)
 *   3. Env vars (`OLLAMA_TEMPERATURE`, `OLLAMA_MAX_TOKENS`, `OLLAMA_TOP_P`)
 *   4. Code defaults
 *
 * The `config` column stores arbitrary JSON — whatever the admin pastes into
 * the settings textarea (e.g. `{"temperature": 0.5, "maxTokens": 2048}`).
 */
export const modelSettings = pgTable("model_settings", {
  modelKey: text("model_key").primaryKey(),
  config: jsonb("config").notNull().default("{}"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
});
