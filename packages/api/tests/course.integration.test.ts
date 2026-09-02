/**
 * Integration tests for the course tRPC router.
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

  const chainDelete = () => ({
    where: vi.fn().mockResolvedValue(undefined),
  });

  const mockDb = {
    select: vi.fn().mockReturnValue(chainSelect([])),
    insert: vi.fn().mockReturnValue(chainWrite()),
    update: vi.fn().mockReturnValue(chainWrite()),
    delete: vi.fn().mockReturnValue(chainDelete()),
    _chainSelect: chainSelect,
    _chainWrite: chainWrite,
    _chainDelete: chainDelete,
  };

  return { mockDb };
});

vi.mock("@bitebase/db", () => ({
  db: mockDb,
  // Export dummy tables to satisfy imports (they are only used for typing)
  courses: {},
  lessons: {},
  progress: {},
  quizzes: {},
  learningProfiles: {},
  users: {},
  sessions: {},
  accounts: {},
  verifications: {},
}));

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

// Mock AI utilities used by admin router
vi.mock("@bitebase/ai", () => ({
  getModel: () => ({ model: "mock-model" }),
  buildLessonSystemPrompt: () => "",
  buildNarrativeThreads: () => [],
  createWebSearchTool: () => null,
  parseLessonResponse: () => ({
    content: "# Mock Lesson",
    estimatedMinutes: 5,
    sources: [],
    quiz: { questions: [], passingScore: 70 },
    sections: [],
  }),
  injectImagesIntoLesson: (lesson) => lesson,
}));

vi.mock("ai", () => ({
  generateText: async () => ({ text: "", toolResults: [] }),
}));

import { appRouter } from "../src/router";
import type { QuizQuestion } from "@bitebase/db";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_USER_ID = "user-1";
const OTHER_USER_ID = "user-2";
const MOCK_LESSON_ID = "lesson-1";
const MOCK_CURRICULUM_ID = "course-1";
const MOCK_PROFILE_ID = "prof-1";

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
  courseId: MOCK_CURRICULUM_ID,
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
  profileId: MOCK_PROFILE_ID,
  title: "Learn TS",
  description: "desc",
  totalEstimatedMinutes: 60,
  sections: [],
  generationStatus: "complete",
  isPublished: true,
  createdAt: new Date(),
};

const mockFailedCurriculum = {
  ...mockCurriculum,
  generationStatus: "failed",
};

const mockProfile = {
  id: MOCK_PROFILE_ID,
  userId: MOCK_USER_ID,
  topic: "TypeScript",
  experienceLevel: "beginner" as const,
  goals: "Build production apps",
  additionalContext: "Focus on practical examples",
  createdAt: new Date(),
};

// ── Context helpers ───────────────────────────────────────────────────────────

/** Returns a mock select chain where each call to .where() returns the next
 *  array from `responses`. Used by tests that need sequential DB queries. */
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

    await expect(caller.course.list()).rejects.toThrow(TRPCError);
    await expect(caller.course.get({ id: "x" })).rejects.toThrow(TRPCError);
    await expect(
      caller.course.getLessons({ courseId: "x" })
    ).rejects.toThrow(TRPCError);
    await expect(
      caller.course.getLesson({ lessonId: "x" })
    ).rejects.toThrow(TRPCError);
    await expect(
      caller.course.submitQuiz({ lessonId: "x", answers: {} })
    ).rejects.toThrow(TRPCError);
  });

  it("throws UNAUTHORIZED (not some other code) for missing session", async () => {
    const caller = appRouter.createCaller(anonCtx() as never);
    try {
      await caller.course.list();
      expect.fail("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("UNAUTHORIZED");
    }
  });
});

// ── course.list ───────────────────────────────────────────────────────────

describe("course.list", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns courses belonging to the current user", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([mockCurriculum]),
    });
    const caller = appRouter.createCaller(authedCtx() as never);
    const result = await caller.course.list();
    expect(result).toEqual([mockCurriculum]);
  });

  it("returns an empty array when the user has no courses", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    });
    const caller = appRouter.createCaller(authedCtx() as never);
    const result = await caller.course.list();
    expect(result).toEqual([]);
  });
});

// ── course.get ────────────────────────────────────────────────────────────

describe("course.get", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns the course when it belongs to the user", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([mockCurriculum]),
    });
    const caller = appRouter.createCaller(authedCtx() as never);
    const result = await caller.course.get({ id: MOCK_CURRICULUM_ID });
    expect(result.id).toBe(MOCK_CURRICULUM_ID);
  });

  it("throws NOT_FOUND when the course does not exist", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    });
    const caller = appRouter.createCaller(authedCtx() as never);
    await expect(caller.course.get({ id: "ghost" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

// ── course.submitQuiz ─────────────────────────────────────────────────────

describe("course.submitQuiz", () => {
  beforeEach(() => vi.clearAllMocks());

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
    const result = await caller.course.submitQuiz({
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
    const result = await caller.course.submitQuiz({
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
    const result = await caller.course.submitQuiz({
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
    await caller.course.submitQuiz({
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
      caller.course.submitQuiz({ lessonId: "no-quiz", answers: {} })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ── course.retryAndGetProfile ─────────────────────────────────────────────

describe("course.retryAndGetProfile", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeDelete() {
    return { where: vi.fn().mockResolvedValue(undefined) };
  }

  it("throws NOT_FOUND when the course belongs to another user", async () => {
    // Ownership check: course found for OTHER user, so this user's query returns []
    mockDb.select.mockImplementation(makeSelectSequence([[]]));

    const caller = appRouter.createCaller({
      session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
      req: {} as Request,
    } as never);

    await expect(
      caller.course.retryAndGetProfile({ id: MOCK_CURRICULUM_ID })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("returns profile fields and course ID without deleting the course", async () => {
    // Sequence: [course], [profile]
    mockDb.select.mockImplementation(
      makeSelectSequence([[mockFailedCurriculum], [mockProfile]])
    );

    const caller = appRouter.createCaller(authedCtx() as never);
    const result = await caller.course.retryAndGetProfile({ id: MOCK_CURRICULUM_ID });

    expect(result.courseId).toBe(MOCK_CURRICULUM_ID);
    expect(result.topic).toBe(mockProfile.topic);
    expect(result.experienceLevel).toBe(mockProfile.experienceLevel);
    expect(result.goals).toBe(mockProfile.goals);
    expect(result.additionalContext).toBe(mockProfile.additionalContext);

    // No delete should be issued — deletion is deferred
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the profile record is missing", async () => {
    // Curriculum found but profile select returns empty
    mockDb.select.mockImplementation(
      makeSelectSequence([[mockFailedCurriculum], []])
    );

    const caller = appRouter.createCaller(authedCtx() as never);
    await expect(
      caller.course.retryAndGetProfile({ id: MOCK_CURRICULUM_ID })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ── course.markLessonCompleted ────────────────────────────────────────────

describe("course.markLessonCompleted", () => {
  beforeEach(() => vi.clearAllMocks());

  function makeWrite() {
    return {
      values: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
  }

  it("marks a lesson as completed with quizScore=100 and quizPassed=true when no prior progress", async () => {
    // Sequence: [lesson], [course (ownership)], [no existing progress],
    //           unlockNextLesson: [completed lesson], [all lessons in course], [no next progress]
    mockDb.select.mockImplementation(
      makeSelectSequence([
        [mockLesson],
        [mockCurriculum],
        [],
        [mockLesson],
        [mockLesson],
        [],
      ])
    );
    const write = makeWrite();
    mockDb.insert.mockReturnValue(write);
    mockDb.update.mockReturnValue(write);

    const caller = appRouter.createCaller(authedCtx() as never);
    await caller.course.markLessonCompleted({ lessonId: MOCK_LESSON_ID });

    // Progress row should have been inserted (no existing row)
    expect(mockDb.insert).toHaveBeenCalled();
    const insertedValues = write.values.mock.calls[0][0] as Record<string, unknown>;
    expect(insertedValues.status).toBe("completed");
    expect(insertedValues.quizScore).toBe(100);
    expect(insertedValues.quizPassed).toBe(true);
  });

  it("updates the existing progress row when one already exists", async () => {
    const existingProgress = {
      id: "prog-1",
      userId: MOCK_USER_ID,
      lessonId: MOCK_LESSON_ID,
      status: "in_progress",
      quizScore: null,
      quizPassed: null,
      quizAttempts: 0,
      completedAt: null,
      lastAccessedAt: new Date(),
    };

    mockDb.select.mockImplementation(
      makeSelectSequence([
        [mockLesson],
        [mockCurriculum],
        [existingProgress],
        [mockLesson],
        [mockLesson],
        [],
      ])
    );
    const write = makeWrite();
    mockDb.insert.mockReturnValue(write);
    mockDb.update.mockReturnValue(write);

    const caller = appRouter.createCaller(authedCtx() as never);
    await caller.course.markLessonCompleted({ lessonId: MOCK_LESSON_ID });

    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the course belongs to another user", async () => {
    // lesson found, but course ownership check fails
    mockDb.select.mockImplementation(
      makeSelectSequence([
        [mockLesson],
        [], // course ownership check → not found
      ])
    );

    const caller = appRouter.createCaller(authedCtx() as never);
    await expect(
      caller.course.markLessonCompleted({ lessonId: MOCK_LESSON_ID })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws NOT_FOUND when the lesson does not exist", async () => {
    mockDb.select.mockImplementation(makeSelectSequence([[]]));

    const caller = appRouter.createCaller(authedCtx() as never);
    await expect(
      caller.course.markLessonCompleted({ lessonId: "ghost-lesson" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ── course.updateCategory ─────────────────────────────────────────────────

describe("course.updateCategory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates category and subcategory for the owner", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([mockCurriculum]),
    });
    const write = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    };
    mockDb.update.mockReturnValue(write);

    const caller = appRouter.createCaller(authedCtx() as never);
    await caller.course.updateCategory({
      courseId: MOCK_CURRICULUM_ID,
      category: "Technology",
      subcategory: "Web Development",
    });

    expect(mockDb.update).toHaveBeenCalled();
    expect(write.set).toHaveBeenCalledWith({
      category: "Technology",
      subcategory: "Web Development",
    });
  });

  it("throws FORBIDDEN when course belongs to another user", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([mockCurriculum]),
    });

    const caller = appRouter.createCaller({
      session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
      req: {} as Request,
    } as never);

    await expect(
      caller.course.updateCategory({
        courseId: MOCK_CURRICULUM_ID,
        category: "Science",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

// ── publicRouter tests ────────────────────────────────────────────────────────

describe("publicRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("listPublished returns all published courses ordered by newest", async () => {
    const courses = [
      { ...mockCurriculum, id: "c1", createdAt: new Date("2026-05-30") },
      { ...mockCurriculum, id: "c2", createdAt: new Date("2026-05-29") },
    ];
    // listPublished uses: select().from().where().orderBy()
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue(courses),
    });

    const caller = appRouter.createCaller(anonCtx() as never);
    const result = await caller.public.listPublished();
    expect(result).toEqual(courses);
  });

  it("listPublished filters by category", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockResolvedValue([{ ...mockCurriculum, category: "Tech" }]),
    });

    const caller = appRouter.createCaller(anonCtx() as never);
    const result = await caller.public.listPublished({ category: "Tech" });
    expect(result).toHaveLength(1);
    expect((result[0] as { category: string }).category).toBe("Tech");
  });

  it("listCategories returns grouped categories", async () => {
    // listCategories uses: select() with specific fields, so mock the full chain
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([
        { category: "Tech", subcategory: "Web" },
        { category: "Tech", subcategory: "Mobile" },
        { category: "Science", subcategory: "Physics" },
      ]),
    });

    const caller = appRouter.createCaller(anonCtx() as never);
    const result = await caller.public.listCategories();
    // Results preserve DB order (Tech appears first in mock data)
    expect(result).toEqual([
      { category: "Tech", subcategories: ["Mobile", "Web"] },
      { category: "Science", subcategories: ["Physics"] },
    ]);
  });

  it("getPublishedLesson returns lesson + quiz for a published course", async () => {
    const lesson = { ...mockLesson, id: "pub-lesson", courseId: MOCK_CURRICULUM_ID };
    const course = { ...mockCurriculum, id: MOCK_CURRICULUM_ID, isPublished: true };
    const quiz = { ...mockQuiz, lessonId: "pub-lesson" };

    mockDb.select.mockImplementation(makeSelectSequence([
      [lesson],     // lessons lookup → found
      [course], // course lookup → published
      [quiz],       // quiz lookup → found
    ]));

    const caller = appRouter.createCaller(anonCtx() as never);
    const result = await caller.public.getPublishedLesson({ lessonId: "pub-lesson" });
    expect(result.lesson).toEqual(lesson);
    expect(result.quiz).toEqual(quiz);
  });

  it("getPublishedLesson returns quiz null when no quiz exists", async () => {
    const lesson = { ...mockLesson, id: "pub-lesson", courseId: MOCK_CURRICULUM_ID };
    const course = { ...mockCurriculum, id: MOCK_CURRICULUM_ID, isPublished: true };

    mockDb.select.mockImplementation(makeSelectSequence([
      [lesson],     // lessons lookup → found
      [course], // course lookup → published
      [],           // quiz lookup → not found
    ]));

    const caller = appRouter.createCaller(anonCtx() as never);
    const result = await caller.public.getPublishedLesson({ lessonId: "pub-lesson" });
    expect(result.lesson).toEqual(lesson);
    expect(result.quiz).toBeNull();
  });

  it("getPublishedLesson throws NOT_FOUND when the parent course is unpublished", async () => {
    const lesson = { ...mockLesson, id: "unpub-lesson", courseId: MOCK_CURRICULUM_ID };
    const course = { ...mockCurriculum, id: MOCK_CURRICULUM_ID, isPublished: false };

    mockDb.select.mockImplementation(makeSelectSequence([
      [lesson],     // lessons lookup → found
      [course], // course lookup → unpublished
    ]));

    const caller = appRouter.createCaller(anonCtx() as never);
    await expect(
      caller.public.getPublishedLesson({ lessonId: "unpub-lesson" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getPublishedLesson throws NOT_FOUND when the lesson does not exist", async () => {
    mockDb.select.mockImplementation(makeSelectSequence([[]]));

    const caller = appRouter.createCaller(anonCtx() as never);
    await expect(
      caller.public.getPublishedLesson({ lessonId: "ghost" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getByTopicSlug returns a published course by slug", async () => {
    const course = { ...mockCurriculum, id: "slug-test", slug: "learn-typescript", isPublished: true };

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([course]),
    });

    const caller = appRouter.createCaller(anonCtx() as never);
    const result = await caller.public.getByTopicSlug({ slug: "learn-typescript" });
    expect(result).toEqual(course);
  });

  it("getByTopicSlug throws NOT_FOUND when slug does not exist", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    });

    const caller = appRouter.createCaller(anonCtx() as never);
    await expect(
      caller.public.getByTopicSlug({ slug: "nonexistent" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("getByTopicSlug throws NOT_FOUND when course is unpublished", async () => {
    const course = { ...mockCurriculum, id: "unpub-slug", slug: "unpublished-topic", isPublished: false };

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([course]),
    });

    const caller = appRouter.createCaller(anonCtx() as never);
    await expect(
      caller.public.getByTopicSlug({ slug: "unpublished-topic" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ── Ownership guard: FORBIDDEN ───────────────────────────────────────────────

describe("ownership guard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("delete throws FORBIDDEN when course exists but belongs to another user", async () => {
    // Curriculum found but belongs to MOCK_USER_ID; caller is OTHER_USER_ID
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([mockCurriculum]),
    });

    const caller = appRouter.createCaller({
      session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
      req: {} as Request,
    } as never);

    await expect(
      caller.course.delete({ id: MOCK_CURRICULUM_ID })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("delete throws NOT_FOUND when course does not exist at all", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    });

    const caller = appRouter.createCaller({
      session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
      req: {} as Request,
    } as never);

    await expect(
      caller.course.delete({ id: "ghost" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("retryAndGetProfile throws FORBIDDEN when course belongs to another user", async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([mockCurriculum]),
    });

    const caller = appRouter.createCaller({
      session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
      req: {} as Request,
    } as never);

    await expect(
      caller.course.retryAndGetProfile({ id: MOCK_CURRICULUM_ID })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

  // Horizontal privilege escalation tests - ensure users cannot access other users' data
  describe("horizontal privilege escalation", () => {
    beforeEach(() => {
      // Mock a course belonging to MOCK_USER_ID
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([mockCurriculum]),
      });
      // Mock related data for lessons, progress, etc.
      mockDb.select.mockImplementation(
        vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([mockLesson]),
        }) // for lesson lookup
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        }) // for progress lookup (no existing progress)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([mockLesson]),
        }) // for lesson list in getLessons
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        }) // for progress list in getLessons
      );
    });

    it("get throws FORBIDDEN when course belongs to another user", async () => {
      const caller = appRouter.createCaller({
        session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
        req: {} as Request,
      } as never);
      await expect(
        caller.course.get({ id: MOCK_CURRICULUM_ID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("getLessons throws FORBIDDEN when course belongs to another user", async () => {
      const caller = appRouter.createCaller({
        session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
        req: {} as Request,
      } as never);
      await expect(
        caller.course.getLessons({ courseId: MOCK_CURRICULUM_ID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("getLesson throws FORBIDDEN when lesson belongs to another user's course", async () => {
      const caller = appRouter.createCaller({
        session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
        req: {} as Request,
      } as never);
      await expect(
        caller.course.getLesson({ lessonId: MOCK_LESSON_ID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("submitQuiz throws FORBIDDEN when lesson belongs to another user's course", async () => {
      // Mock quiz lookup
      mockDb.select.mockImplementation(
        vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([{ id: "quiz-1", lessonId: MOCK_LESSON_ID, questions: [], passingScore: 70 }]),
        }) // quiz lookup
        .mockReturnValueOnce({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockResolvedValue([]),
        }) // existing progress (none)
      );
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      });

      const caller = appRouter.createCaller({
        session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
        req: {} as Request,
      } as never);
      await expect(
        caller.course.submitQuiz({ lessonId: MOCK_LESSON_ID, answers: {} })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("markLessonCompleted throws FORBIDDEN when lesson belongs to another user's course", async () => {
      const caller = appRouter.createCaller({
        session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
        req: {} as Request,
      } as never);
      await expect(
        caller.course.markLessonCompleted({ lessonId: MOCK_LESSON_ID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("markLessonStarted throws FORBIDDEN when lesson belongs to another user's course", async () => {
      // Mock no existing progress
      mockDb.select.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      });
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(undefined),
      });

      const caller = appRouter.createCaller({
        session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
        req: {} as Request,
      } as never);
      await expect(
        caller.course.markLessonStarted({ lessonId: MOCK_LESSON_ID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("getNextLesson throws FORBIDDEN when lesson belongs to another user's course", async () => {
      const caller = appRouter.createCaller({
        session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
        req: {} as Request,
      } as never);
      await expect(
        caller.course.getNextLesson({ lessonId: MOCK_LESSON_ID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("getProgressForCourse throws FORBIDDEN when course belongs to another user", async () => {
      const caller = appRouter.createCaller({
        session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
        req: {} as Request,
      } as never);
      await expect(
        caller.course.getProgressForCourse({ courseId: MOCK_CURRICULUM_ID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("getLessonProgress throws FORBIDDEN when lesson belongs to another user's course", async () => {
      const caller = appRouter.createCaller({
        session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
        req: {} as Request,
      } as never);
      await expect(
        caller.course.getLessonProgress({ lessonId: MOCK_LESSON_ID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("getProfile throws FORBIDDEN when course belongs to another user", async () => {
      const caller = appRouter.createCaller({
        session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
        req: {} as Request,
      } as never);
      await expect(
        caller.course.getProfile({ courseId: MOCK_CURRICULUM_ID })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    it("updateCategory throws FORBIDDEN when course belongs to another user", async () => {
      const caller = appRouter.createCaller({
        session: { user: { id: OTHER_USER_ID, name: "Other", email: "o@o.com" } },
        req: {} as Request,
      } as never);
      await expect(
        caller.course.updateCategory({ courseId: MOCK_CURRICULUM_ID, category: "Test" })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });
  });
