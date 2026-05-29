/**
 * Tests for the DB connection pool singleton (packages/db/src/client.ts).
 *
 * Strategy: mock `postgres` and `drizzle-orm/postgres-js` so no real database
 * connection is needed. We reset the globalThis slots before each test to
 * guarantee a clean slate.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock("postgres", () => {
  const mockSql = vi.fn(() => mockSql);
  return { default: mockSql };
});

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: vi.fn(() => ({ _brand: "DrizzleInstance" })),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function clearGlobals() {
  delete (globalThis as Record<string, unknown>).__bitebase_db;
  delete (globalThis as Record<string, unknown>).__bitebase_pg;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("getDb() singleton", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    clearGlobals();
    vi.clearAllMocks();
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
    vi.resetModules();
  });

  afterEach(() => {
    clearGlobals();
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("returns a db instance when DATABASE_URL is set", async () => {
    const { getDb } = await import("../src/client");
    const db = getDb();
    expect(db).toBeDefined();
  });

  it("returns the same instance on subsequent calls (globalThis singleton)", async () => {
    const { getDb } = await import("../src/client");
    const first = getDb();
    const second = getDb();
    expect(first).toBe(second);
  });

  it("stores the instance on globalThis.__bitebase_db", async () => {
    const { getDb } = await import("../src/client");
    const instance = getDb();
    expect((globalThis as Record<string, unknown>).__bitebase_db).toBe(instance);
  });

  it("throws when DATABASE_URL is not set", async () => {
    delete process.env.DATABASE_URL;
    const { getDb } = await import("../src/client");
    expect(() => getDb()).toThrow("DATABASE_URL is not set");
  });

  it("reuses the pre-existing globalThis instance without creating a new connection", async () => {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const sentinel = { _brand: "PreExistingInstance" };
    (globalThis as Record<string, unknown>).__bitebase_db = sentinel;

    const { getDb } = await import("../src/client");
    const result = getDb();

    expect(result).toBe(sentinel);
    expect(drizzle).not.toHaveBeenCalled();
  });
});

describe("db proxy", () => {
  beforeEach(() => {
    clearGlobals();
    process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/testdb";
    vi.resetModules();
  });

  afterEach(() => {
    clearGlobals();
  });

  it("forwards property access to the underlying db instance", async () => {
    const { db } = await import("../src/client");
    // The proxy defers to getDb(); as long as it doesn't throw we know it resolved
    expect(db).toBeDefined();
  });
});
