/**
 * Tests for getEffectiveModelConfig().
 *
 * Strategy: mock @bitebase/db at the module boundary so we can control
 * what the DB returns and verify the resolution hierarchy:
 *   exact key > "default" row > env vars > code defaults
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb } = vi.hoisted(() => {
  let _rows: unknown[] = [];

  // Creates a thenable query-builder chain.
  // All builder methods (.from, .where, .limit) return the same object for
  // chaining. The query resolves to `_rows` when awaited (via .then).
  function makeChain() {
    const qb = {
      from: vi.fn(() => qb),
      where: vi.fn(() => qb),
      limit: vi.fn(() => qb),
      then: vi.fn((onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(_rows).then(onFulfilled),
      ),
      catch: vi.fn(),
    };
    return qb;
  }

  return {
    mockDb: {
      select: vi.fn(() => makeChain()),
      _setRows: (rows: unknown[]) => {
        _rows = rows;
      },
    },
  };
});

vi.mock("@bitebase/db", () => ({
  db: mockDb,
  modelSettings: {},
}));

vi.mock("drizzle-orm", () => ({
  eq: (a: unknown) => a,
  or: (...args: unknown[]) => args,
}));

const OLD_ENV = { ...process.env };

beforeEach(() => {
  // Reset mock call counts but preserve .mockImplementation
  mockDb.select.mockClear();
  // Reset env vars for each test
  process.env = { ...OLD_ENV };
  delete process.env.OLLAMA_TEMPERATURE;
  delete process.env.OLLAMA_MAX_TOKENS;
  delete process.env.OLLAMA_TOP_P;
  delete process.env.OLLAMA_MODEL;
  // Reset DB rows to empty
  mockDb._setRows([]);
});

import { getEffectiveModelConfig } from "../src/lib/model-config";

describe("getEffectiveModelConfig", () => {
  it("returns empty object when DB has no rows and no env vars", async () => {
    const config = await getEffectiveModelConfig("llama3.2");
    expect(config).toEqual({});
  });

  it("applies env vars when DB has no rows", async () => {
    process.env.OLLAMA_TEMPERATURE = "0.5";
    process.env.OLLAMA_MAX_TOKENS = "4096";
    process.env.OLLAMA_TOP_P = "0.9";

    const config = await getEffectiveModelConfig();
    expect(config.temperature).toBe(0.5);
    expect(config.maxTokens).toBe(4096);
    expect(config.topP).toBe(0.9);
  });

  it("applies partial env vars when DB has no rows", async () => {
    process.env.OLLAMA_TEMPERATURE = "0.3";

    const config = await getEffectiveModelConfig("any-key");
    expect(config.temperature).toBe(0.3);
    expect(config.maxTokens).toBeUndefined();
    expect(config.topP).toBeUndefined();
  });

  it("uses the 'default' row when no exact key matches", async () => {
    mockDb._setRows([
      { modelKey: "default", config: { temperature: 0.8, maxTokens: 2048 } },
    ]);

    const config = await getEffectiveModelConfig("unknown-model");
    expect(config.temperature).toBe(0.8);
    expect(config.maxTokens).toBe(2048);
  });

  it("prefers exact key over 'default' row", async () => {
    mockDb._setRows([
      { modelKey: "default", config: { temperature: 0.8 } },
      { modelKey: "llama3.2", config: { temperature: 0.5, maxTokens: 4096 } },
    ]);

    const config = await getEffectiveModelConfig("llama3.2");
    expect(config.temperature).toBe(0.5);
    expect(config.maxTokens).toBe(4096);
  });

  it("merges default and exact rows (default fills gaps)", async () => {
    mockDb._setRows([
      { modelKey: "default", config: { topP: 0.9 } },
      { modelKey: "qwen-7b", config: { temperature: 0.3, maxTokens: 8192 } },
    ]);

    const config = await getEffectiveModelConfig("qwen-7b");
    expect(config.temperature).toBe(0.3);
    expect(config.maxTokens).toBe(8192);
    expect(config.topP).toBe(0.9);
  });

  it("env vars do NOT override DB values", async () => {
    mockDb._setRows([
      { modelKey: "llama3.2", config: { temperature: 0.2 } },
    ]);
    process.env.OLLAMA_TEMPERATURE = "0.9";

    const config = await getEffectiveModelConfig("llama3.2");
    expect(config.temperature).toBe(0.2);
  });

  it("env vars fill in when DB row is missing a key", async () => {
    mockDb._setRows([
      { modelKey: "llama3.2", config: { temperature: 0.2 } },
    ]);
    process.env.OLLAMA_MAX_TOKENS = "2048";

    const config = await getEffectiveModelConfig("llama3.2");
    expect(config.temperature).toBe(0.2);
    expect(config.maxTokens).toBe(2048);
  });

  it("falls back to OLLAMA_MODEL env var for key when not provided", async () => {
    mockDb._setRows([
      { modelKey: "my-model", config: { temperature: 0.7 } },
    ]);
    process.env.OLLAMA_MODEL = "my-model";

    const config = await getEffectiveModelConfig();
    expect(config.temperature).toBe(0.7);
  });

  it("handles database errors gracefully — returns {}", async () => {
    mockDb.select = vi.fn(() => {
      throw new Error("DB connection lost");
    });

    const config = await getEffectiveModelConfig("llama3.2");
    expect(config).toEqual({});
  });

  it("handles null/undefined config gracefully", async () => {
    mockDb._setRows([
      { modelKey: "llama3.2", config: null },
    ]);

    const config = await getEffectiveModelConfig("llama3.2");
    expect(config).toEqual({});
  });

  it("handles default row with null config", async () => {
    mockDb._setRows([
      { modelKey: "default", config: null },
    ]);

    const config = await getEffectiveModelConfig("unknown");
    expect(config).toEqual({});
  });
});
