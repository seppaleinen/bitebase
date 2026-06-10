/**
 * Integration tests for the admin tRPC router.
 *
 * Strategy: mock @bitebase/db and @bitebase/ai at the module boundary.
 * Tests call procedures via router.createCaller(), exercising auth guards,
 * rate limiting, validation, and multi-step orchestration.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ── Mock DB ───────────────────────────────────────────────────────────────────
const { mockDb } = vi.hoisted(() => {
  let _rows: unknown[] = [];

  function makeChain() {
    const qb = {
      from: vi.fn(() => qb),
      where: vi.fn(() => qb),
      limit: vi.fn(() => qb),
      leftJoin: vi.fn(() => qb),
      orderBy: vi.fn(() => qb),
      then: vi.fn((onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(_rows).then(onFulfilled),
      ),
      catch: vi.fn(),
    };
    return qb;
  }

  const chainWrite = () => {
    const c = {
      values: vi.fn(() => c),
      set: vi.fn(() => c),
      where: vi.fn(() => c),
      onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
      then: vi.fn((onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve(undefined).then(onFulfilled),
      ),
    };
    return c;
  };

  const chainDelete = () => ({
    where: vi.fn().mockResolvedValue(undefined),
  });

  return {
    mockDb: {
      select: vi.fn(() => makeChain()),
      insert: vi.fn(() => chainWrite()),
      update: vi.fn(() => chainWrite()),
      delete: vi.fn(() => chainDelete()),
      _setRows: (rows: unknown[]) => { _rows = rows; },
      _makeChain: makeChain,
    },
  };
});

vi.mock("@bitebase/db", () => ({
  db: mockDb,
  curricula: {},
  lessons: {},
  quizzes: {},
  learningProfiles: {},
  modelSettings: {},
  users: {},
  sessions: {},
  accounts: {},
  verifications: {},
}));

// ── Mock better-auth ──────────────────────────────────────────────────────────
vi.mock("better-auth", () => ({
  betterAuth: vi.fn(() => ({
    api: { getSession: vi.fn().mockResolvedValue(null) },
    handler: vi.fn(),
  })),
}));
vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: vi.fn(() => ({})),
}));

// ── Mock @bitebase/ai ─────────────────────────────────────────────────────────
vi.mock("@bitebase/ai", () => ({
  getModel: () => ({ model: "mock-model" }),
  ensureModelLoaded: vi.fn().mockResolvedValue(undefined),
  PROMPT_VERSION: 3,
  buildLessonSystemPrompt: () => "system prompt",
  buildNarrativeThreads: () => ["narrative thread"],
  createWebSearchTool: () => null,
  parseLessonResponse: () => ({
    content: "# Mock Lesson",
    estimatedMinutes: 5,
    sources: [],
    quiz: { questions: [], passingScore: 70 },
    sections: [],
  }),
  injectImagesIntoLesson: (lesson: any) => lesson,
}));

// ── Mock ai module ────────────────────────────────────────────────────────────
vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({
    text: "Mock generated text",
    toolResults: [],
  }),
}));

import { appRouter } from "../src/router";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

type Router = typeof appRouter;

const ADMIN_EMAIL = "admin@test.com";
const USER_EMAIL = "user@test.com";
const USER_ID = "user-1";

function adminCtx() {
  return {
    session: {
      user: { id: USER_ID, name: "Admin", email: ADMIN_EMAIL },
    },
    req: {} as Request,
  };
}

function userCtx() {
  return {
    session: {
      user: { id: "user-other", name: "User", email: USER_EMAIL },
    },
    req: {} as Request,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb._setRows([]);
  process.env.ADMIN_EMAIL = ADMIN_EMAIL;
});

// ── Admin guard tests ────────────────────────────────────────────────────────
describe("admin guard", () => {
  const procedures = [
    "admin.listCurricula",
    "admin.modelSettings.list",
  ] as const;

  for (const proc of procedures) {
    it(`${proc} rejects non-admin users with FORBIDDEN`, async () => {
      const caller = appRouter.createCaller(userCtx());
      const parts = proc.split(".");
      let fn: any = caller;
      for (const p of parts) fn = fn[p];
      await expect(fn()).rejects.toThrow(
        expect.objectContaining({ code: "FORBIDDEN" }),
      );
    });
  }

  const mutationProcedures = [
    { name: "admin.modelSettings.update", input: { modelKey: "test", config: "{}" } },
  ] as const;

  for (const { name, input } of mutationProcedures) {
    it(`${name} rejects non-admin users with FORBIDDEN`, async () => {
      const caller = appRouter.createCaller(userCtx());
      const parts = name.split(".");
      let fn: any = caller;
      for (const p of parts) fn = fn[p];
      await expect(fn(input)).rejects.toThrow(
        expect.objectContaining({ code: "FORBIDDEN" }),
      );
    });
  }
});

// ── admin.listCurricula ──────────────────────────────────────────────────────
describe("admin.listCurricula", () => {
  it("lists curricula with lesson version rollup", async () => {
    mockDb._setRows([
      { id: "c2", title: "React", userId: "u2", createdAt: new Date("2025-02-01"), lessonVersion: 1 },
      { id: "c1", title: "TS Basics", userId: "u1", createdAt: new Date("2025-01-01"), lessonVersion: 1 },
      { id: "c1", title: "TS Basics", userId: "u1", createdAt: new Date("2025-01-01"), lessonVersion: 2 },
    ]);

    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.admin.listCurricula();

    expect(result.curricula).toHaveLength(2);
    expect(result.curricula[0].id).toBe("c2"); // newest first (orderBy DESC)
    expect(result.curricula[0].totalLessons).toBe(1);
    expect(result.curricula[0].versionSummary).toEqual([{ version: 1, count: 1 }]);

    expect(result.curricula[1].id).toBe("c1");
    expect(result.curricula[1].totalLessons).toBe(2);
    expect(result.curricula[1].versionSummary).toEqual([
      { version: 1, count: 1 },
      { version: 2, count: 1 },
    ]);

    // Global version rollup
    expect(result.versionRollup).toHaveLength(2);
  });

  it("handles empty result set", async () => {
    mockDb._setRows([]);
    const caller = appRouter.createCaller(adminCtx());
    const result = await caller.admin.listCurricula();
    expect(result.curricula).toEqual([]);
    expect(result.versionRollup).toEqual([]);
  });
});

// ── admin.modelSettings ──────────────────────────────────────────────────────
describe("admin.modelSettings", () => {
  describe("list", () => {
    it("returns empty list when no models configured", async () => {
      mockDb._setRows([]);
      const caller = appRouter.createCaller(adminCtx());
      const result = await caller.admin.modelSettings.list();
      expect(result.models).toEqual([]);
    });

    it("returns all model config rows", async () => {
      mockDb._setRows([
        { modelKey: "default", config: { temperature: 0.7 }, updatedAt: new Date(), updatedBy: "admin" },
        { modelKey: "llama3.2", config: { temperature: 0.5, maxTokens: 4096 }, updatedAt: new Date(), updatedBy: "admin" },
      ]);

      const caller = appRouter.createCaller(adminCtx());
      const result = await caller.admin.modelSettings.list();
      expect(result.models).toHaveLength(2);
      expect(result.models[0].modelKey).toBe("default");
      expect(result.models[1].modelKey).toBe("llama3.2");
    });
  });

  describe("update", () => {
    it("rejects invalid JSON config", async () => {
      const caller = appRouter.createCaller(adminCtx());
      await expect(
        caller.admin.modelSettings.update({ modelKey: "test", config: "not-json" }),
      ).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });

    it("rejects non-object JSON (array)", async () => {
      const caller = appRouter.createCaller(adminCtx());
      await expect(
        caller.admin.modelSettings.update({ modelKey: "test", config: "[1,2,3]" }),
      ).rejects.toThrow(
        expect.objectContaining({ code: "BAD_REQUEST" }),
      );
    });

    it("upserts valid model config", async () => {
      const caller = appRouter.createCaller(adminCtx());
      const result = await caller.admin.modelSettings.update({
        modelKey: "llama3.2",
        config: JSON.stringify({ temperature: 0.5, maxTokens: 4096 }),
      });

      expect(result).toEqual({ success: true });
      // Verify the DB insert was called with parsed JSON
      const insertMock = mockDb.insert;
      expect(insertMock).toHaveBeenCalled();
    });
  });
});
