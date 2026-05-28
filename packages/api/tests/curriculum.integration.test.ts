/**
 * Integration tests for the curriculum tRPC router.
 *
 * Strategy: mock @bitebase/db at the module boundary so tests are fast and
 * deterministic — no real database needed. We call procedures via
 * router.createCaller(), exercising all the router logic (auth guard, scoring,
 * unlock) without hitting the network.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// vi.mock is hoisted above all imports, so mockDb must be created with vi.hoisted
const { mockDb } = vi.hoisted(() => {
  const chainSelect = (rows: unknown[]) => ({
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
    innerJoin: vi.fn().mockReturnThis(),
  });

  const chainWrite = () => ({
    values: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(undefined),
  });

  const mockDb = {
    select: vi.fn().mockReturnValue(chainSelect([])),
    insert: vi.fn().mockReturnValue(chainWrite()),
    update: vi.fn().mockReturnValue(chainWrite()),
    _chainSelect: chainSelect,
    _chainWrite: chainWrite,
  };

  return { mockDb };
});

vi.mock("@bitebase/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@bitebase/db")>();
  return { ...actual, db: mockDb };
});

// Also mock better-auth so it doesn't try to connect to the DB at import time
vi.mock("better-auth", () => ({
  betterAuth: vi.fn(() => ({
    api: { getSession: vi.fn().mockResolvedValue(null) },
    handler: vi.fn(),
  })),
}));
vi.mock("better-auth/adapters/drizzle", () => ({
  drizzleAdapter: vi.fn(() => ({})),
}));

import { appRouter } from "../src/router";
import type { QuizQuestion } from "@bitebase/db";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_USER_ID = "user-1";
const MOCK_LESSON_ID = "lesson-1";
const MOCK_CURRICULUM_ID = "curriculum-1";

const mockQuizQuestions: QuizQuestion[] = [
  {
    id: "q1",
    type: "multiple_choice",
    question: "Q1",
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    explanation: "A is correct.",
  },
  {
    id: "q2",
    type: "multiple_choice",
    question: "Q2",
    options: ["A", "B", "C", "D"],
    correctAnswer: "B",
    explanation: "B is correct.",
  },
  {
    id: "q3",
    type: "multiple_choice",
    question: "Q3",
    options: ["A", "B", "C", "D"],
    correctAnswer: "C",
    explanation: "C is correct.",
  },
];

const mockQuiz = {
  id: "quiz-1",
  lessonId: MOCK_LESSON_ID,
  questions: mockQuizQuestions,
  passingScore: 70,
  createdAt: new Date(),
};

const mockLesson = {
  id: MOCK_LESSON_ID,
  curriculumId: MOCK_CURRICULUM_ID,
  sectionId: "sec-1",
  subsectionId: "sub-1",
  title: "Intro",
  content: "# Intro",
  sources: [],
  estimatedMinutes: 10,
  order: 0,
  createdAt: new Date(),
};

const mockCurriculum = {
  id: MOCK_CURRICULUM_ID,
  userId: MOCK_USER_ID,
  profileId: "prof-1",
  title: "Learn TS",
  description: "desc",
  totalEstimatedMinutes: 60,
  sections: [],
  generationStatus: "complete",
  createdAt: new Date(),
};

// ── Context helpers ───────────────────────────────────────────────────────────

function authedCtx() {
  return {
    session: { user: { id: MOCK_USER_ID, name: "Test", email: "t@t.com" } },
    req: {} as Request,
  };
}

function anonCtx() {
  return { session: null, req: {} as Request };
}

// ── Auth guard ────────────────────────────────────────────────────────────────

describe("auth guard", () => {
  it("rejects unauthenticated calls on every protected procedure", async () => {
    const caller = appRouter.createCaller(anonCtx() as never);

    await expect(caller.curriculum.list()).rejects.toThrow(TRPCError);
    await expect(caller.curriculum.get({ id: "x" })).rejects.toThrow(TRPCError);
    await expect(
      caller.curriculum.getLessons({ curriculumId: "x" })
    ).rejects.toThrow(TRPCError);
    await expect(
      caller.curriculum.getLesson({ lessonId: "x" })
    ).rejects.toThrow(TRPCError);
    await expect(
      caller.curriculum.submitQuiz({ lessonId: "x", answers: {} })
    ).rejects.toThrow(TRPCError);
  });

  it("throws UNAUTHORIZED (not some other code) for missing session", async () => {
    const caller = appRouter.createCaller(anonCtx() as never);
    try {
      await caller.curriculum.list();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("UNAUTHORIZED");
    }
  });
});

// ── curriculum.list ───────────────────────────────────────────────────────────

describe("curriculum.list", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns curricula belonging to the current user", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([mockCurriculum]),
    });
    const caller = appRouter.createCaller(authedCtx() as never);
    const result = await caller.curriculum.list();
    expect(result).toEqual([mockCurriculum]);
  });

  it("returns an empty array when the user has no curricula", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    });
    const caller = appRouter.createCaller(authedCtx() as never);
    const result = await caller.curriculum.list();
    expect(result).toEqual([]);
  });
});

// ── curriculum.get ────────────────────────────────────────────────────────────

describe("curriculum.get", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the curriculum when it belongs to the user", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([mockCurriculum]),
    });
    const caller = appRouter.createCaller(authedCtx() as never);
    const result = await caller.curriculum.get({ id: MOCK_CURRICULUM_ID });
    expect(result.id).toBe(MOCK_CURRICULUM_ID);
  });

  it("throws NOT_FOUND when the curriculum does not exist", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    });
    const caller = appRouter.createCaller(authedCtx() as never);
    await expect(caller.curriculum.get({ id: "ghost" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ── curriculum.submitQuiz ─────────────────────────────────────────────────────

describe("curriculum.submitQuiz", () => {
  beforeEach(() => vi.clearAllMocks());

  // Each test configures its own mockDb.select sequence
  function makeSelectSequence(responses: unknown[][]) {
    let call = 0;
    return () => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        const result = responses[call] ?? [];
        call++;
        return Promise.resolve(result);
      }),
    });
  }

  function makeWrite() {
    const chain = {
      values: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    return chain;
  }

  it("returns 100% and passed=true when all answers are correct", async () => {
    // Sequence: [quiz], [no existing progress], [completed lesson], [all lessons with one more], [no next progress]
    mockDb.select.mockImplementation(
      makeSelectSequence([
        [mockQuiz],
        [],
        [mockLesson],
        [mockLesson, { ...mockLesson, id: "lesson-2", order: 1 }],
        [],
      ])
    );
    const write = makeWrite();
    mockDb.insert.mockReturnValue(write);
    mockDb.update.mockReturnValue(write);

    const caller = appRouter.createCaller(authedCtx() as never);
    const result = await caller.curriculum.submitQuiz({
      lessonId: MOCK_LESSON_ID,
      answers: { q1: "A", q2: "B", q3: "C" },
    });

    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.correct).toBe(3);
    expect(result.total).toBe(3);
  });

  it("returns passed=false when score is below the passing threshold", async () => {
    mockDb.select.mockImplementation(
      makeSelectSequence([[mockQuiz], []])
    );
    const write = makeWrite();
    mockDb.insert.mockReturnValue(write);
    mockDb.update.mockReturnValue(write);

    const caller = appRouter.createCaller(authedCtx() as never);
    const result = await caller.curriculum.submitQuiz({
      lessonId: MOCK_LESSON_ID,
      answers: { q1: "A", q2: "WRONG", q3: "WRONG" }, // 1/3 = 33%
    });

    expect(result.passed).toBe(false);
    expect(result.score).toBe(33);
  });

  it("identifies which questions were answered incorrectly", async () => {
    mockDb.select.mockImplementation(
      makeSelectSequence([[mockQuiz], []])
    );
    const write = makeWrite();
    mockDb.insert.mockReturnValue(write);
    mockDb.update.mockReturnValue(write);

    const caller = appRouter.createCaller(authedCtx() as never);
    const result = await caller.curriculum.submitQuiz({
      lessonId: MOCK_LESSON_ID,
      answers: { q1: "A", q2: "WRONG", q3: "C" },
    });

    const byId = Object.fromEntries(result.feedback.map((f) => [f.questionId, f]));
    expect(byId.q1.correct).toBe(true);
    expect(byId.q2.correct).toBe(false);
    expect(byId.q2.correctAnswer).toBe("B");
    expect(byId.q3.correct).toBe(true);
  });

  it("uses db.update (not insert) when progress already exists and quiz fails", async () => {
    // Use a failing score so unlockNextLesson is never called — isolates the update path
    const existingProgress = {
      id: "prog-1",
      userId: MOCK_USER_ID,
      lessonId: MOCK_LESSON_ID,
      status: "in_progress",
      quizScore: 33,
      quizPassed: false,
      quizAttempts: 1,
      completedAt: null,
      lastAccessedAt: new Date(),
    };

    mockDb.select.mockImplementation(
      makeSelectSequence([
        [mockQuiz],        // quiz lookup
        [existingProgress], // existing progress found
      ])
    );
    const write = makeWrite();
    mockDb.insert.mockReturnValue(write);
    mockDb.update.mockReturnValue(write);

    const caller = appRouter.createCaller(authedCtx() as never);
    await caller.curriculum.submitQuiz({
      lessonId: MOCK_LESSON_ID,
      // 1/3 = 33%, fails → no unlock, no insert
      answers: { q1: "A", q2: "WRONG", q3: "WRONG" },
    });

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when no quiz exists for the lesson", async () => {
    mockDb.select.mockImplementation(makeSelectSequence([[]]));

    const caller = appRouter.createCaller(authedCtx() as never);
    await expect(
      caller.curriculum.submitQuiz({ lessonId: "no-quiz", answers: {} })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
