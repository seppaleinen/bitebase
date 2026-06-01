import { test as base, type Page } from "@playwright/test";

/**
 * Shared test helpers for BiteBase E2E tests.
 */

// ── Auth API mocks ─────────────────────────────────────────────────────────────

/**
 * Mock Better Auth endpoints so tests never hit a real database.
 * - /api/auth/sign-up/email → 200 + fake session cookie
 * - /api/auth/sign-in/email → 200 + fake session cookie
 * - /api/auth/get-session   → 200 + fake user
 */
export async function mockAuth(page: Page, { fail = false } = {}) {
  const fakeUser = {
    id: "test-user-1",
    name: "Test User",
    email: "test@bitebase.dev",
    emailVerified: true,
    image: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const fakeSession = {
    session: {
      id: "session-1",
      userId: fakeUser.id,
      token: "fake-token",
      expiresAt: new Date(Date.now() + 86400_000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    user: fakeUser,
  };

  if (fail) {
    await page.route("**/api/auth/sign-in/email", (route) =>
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ error: "Invalid credentials" }),
      })
    );
  } else {
    // Pre-set the Playwright test bypass cookie so that after successful auth the
    // server-side layout allows access to protected routes without a real DB session.
    await page.context().addCookies([
      {
        name: "__playwright_test__",
        value: "1",
        domain: "localhost",
        path: "/",
      },
    ]);

    await page.route("**/api/auth/sign-up/email", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fakeSession),
      })
    );

    await page.route("**/api/auth/sign-in/email", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(fakeSession),
      })
    );
  }

  // Always mock get-session to return our fake session (used by the app layout)
  await page.route("**/api/auth/get-session", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(fail ? null : fakeSession),
    })
  );
}

type TRPCMockData = {
  curricula?: object[];
  lessons?: object[];
  lesson?: object | null;
  quiz?: object | null;
  progress?: object | null;
  quizResult?: object | null;
  nextLesson?: object | null;
  user?: object | null;
  categories?: { category: string; subcategories: string[] }[];
  admin?: {
    listLessonVersions?: { detail: { lessonId: string; version: number; count: number }[]; rollup: { version: number; totalLessons: number; totalRows: number }[] };
    regenerateLesson?: { lessonId: string; newVersion: number };
    regenerateLessonsByVersion?: { lessonId: string; newVersion: number }[];
  };
};

function resolveData(procedurePath: string, data: TRPCMockData): unknown {
  const { curricula = [], lessons = [], lesson = null, quiz = null, progress = null, quizResult = null, nextLesson = null, user = null } = data;

  // Auth / session
  if (procedurePath === "public.getSession") {
    // Use explicit user from test data, or default to the E2E test user
    return user ?? { id: "playwright-test-user", name: "Test User", email: "test@playwright.dev", image: null };
  }
  if (procedurePath === "curriculum.getProfile") return null;

  // Public browse
  if (procedurePath === "public.listCategories") return data.categories ?? [];
  if (procedurePath === "public.listPublished") return curricula;
  if (procedurePath === "public.getPublishedCurriculum") return curricula[0] ?? null;
  if (procedurePath === "public.getPublishedLessons") return lessons;
  if (procedurePath === "public.getPublishedLesson") return { lesson, quiz };

  // Curriculum owner-only
  if (procedurePath === "curriculum.list") return curricula;
  if (procedurePath === "curriculum.get") return curricula[0] ?? null;
  if (procedurePath === "curriculum.getLessons") return lessons;
  if (procedurePath === "curriculum.getLesson") return { lesson, quiz, progress };
  if (procedurePath === "curriculum.submitQuiz") return quizResult;
  if (procedurePath === "curriculum.markLessonStarted") return null;
  if (procedurePath === "curriculum.getNextLesson") return nextLesson ?? null;

  // Progress procedures
  if (procedurePath === "curriculum.getProgressForCurriculum") return progress ? [progress] : [];
  if (procedurePath === "curriculum.getLessonProgress") return progress ?? null;

  // Category
  if (procedurePath === "curriculum.updateCategory") return null;
    if (procedurePath === "admin.listLessonVersions") return data.admin?.listLessonVersions ?? { detail: [], rollup: [] };

    if (procedurePath === "admin.regenerateLesson") return data.admin?.regenerateLesson ?? null;

    if (procedurePath === "admin.regenerateLessonsByVersion") return data.admin?.regenerateLessonsByVersion ?? [];
}

/**
 * Mock the tRPC curriculum router via the batch POST endpoint.
 *
 * httpBatchStreamLink POSTs to /api/trpc with a JSON body like:
 *   {"0": {"json": <input>}, "1": {"json": <input>}, ...}
 * and a query param like ?batch=1&0.procedure=curriculum.list
 *
 * We respond with the tRPC batch JSON format:
 *   [{"result":{"data":{"json":<result>}}}, ...]
 */
export async function mockTRPC(page: Page, data: TRPCMockData = {}) {
  // Use a regex so we match both /api/trpc and /api/trpc/<procedure>?batch=1
  await page.route(/\/api\/trpc/, async (route) => {
    const url = new URL(route.request().url());

    // httpBatchLink sends GET /api/trpc/curriculum.list?batch=1 for queries
    // and POST /api/trpc/curriculum.submitQuiz?batch=1 for mutations.
    // Extract procedure name(s) from the path segment after /api/trpc/.
    const procedures: string[] = [];
    const pathPart = url.pathname.split("/api/trpc/")[1];
    if (pathPart) {
      procedures.push(...pathPart.split(","));
    }

    const results = procedures.map((proc) => ({
      result: { data: resolveData(proc, data) },
    }));

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(results.length > 0 ? results : [{ result: { data: null } }]),
    });
  });
}

/**
 * Mock AI endpoints so onboarding works without Ollama running.
 */
export async function mockAI(page: Page) {
  // Mock the streaming chat endpoint
  await page.route("**/api/onboarding/chat", (route) => {
    const body = [
      `0:"Hi! I can see you want to learn something. Let me help you get started."\n`,
      `e:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20},"isContinued":false}\n`,
      `d:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20}}\n`,
    ].join("");

    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body,
    });
  });

  // Mock the SSE curriculum generation endpoint
  await page.route("**/api/onboarding/generate", (route) => {
    const curriculumId = "mock-curriculum-1";
    const body = [
      `data: ${JSON.stringify({ event: "status", data: { message: "Saving your learning profile..." } })}\n\n`,
      `data: ${JSON.stringify({ event: "curriculum_created", data: { curriculumId, title: "Test Curriculum", totalSections: 2 } })}\n\n`,
      `data: ${JSON.stringify({ event: "status", data: { message: "Creating lessons..." } })}\n\n`,
      `data: ${JSON.stringify({ event: "done", data: { curriculumId } })}\n\n`,
    ].join("");

    return route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body,
    });
  });
}

/**
 * Set the Playwright test-bypass cookie so the Next.js app layout uses a mock
 * session without requiring a real database. Only works in non-production.
 */
export async function setTestSession(page: Page) {
  // Navigate to root first to get the domain context, then set cookie
  await page.goto("/");
  await page.context().addCookies([
    {
      name: "__playwright_test__",
      value: "1",
      domain: "localhost",
      path: "/",
    },
  ]);
}

// ── Extended test fixture ──────────────────────────────────────────────────────

type BiteBaseFixtures = {
  authedPage: Page;
};

export const test = base.extend<BiteBaseFixtures>({
  authedPage: async ({ page }, use) => {
    await mockAuth(page);
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect } from "@playwright/test";
