import {
  pgTable,
  text,
  timestamp,
  doublePrecision,
  integer,
} from "drizzle-orm/pg-core";

/**
 * Runtime model configuration — single-row table keyed on `id = 'default'`.
 * Each nullable column represents a setting the admin can change from the UI.
 * When a column is NULL the system falls back to the corresponding env var,
 * then to the code-defined default.
 */
export const modelSettings = pgTable("model_settings", {
  id: text("id").primaryKey().default("default"),
  temperature: doublePrecision("temperature"),
  maxTokens: integer("max_tokens"),
  topP: doublePrecision("top_p"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
});
