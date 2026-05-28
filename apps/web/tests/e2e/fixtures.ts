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
};

function resolveData(procedurePath: string, data: TRPCMockData): unknown {
  const { curricula = [], lessons = [], lesson = null, quiz = null, progress = null, quizResult = null } = data;
  if (procedurePath === "curriculum.list") return curricula;
  if (procedurePath === "curriculum.get") return curricula[0] ?? null;
  if (procedurePath === "curriculum.getLessons") return lessons;
  if (procedurePath === "curriculum.getLesson") return { lesson, quiz, progress };
  if (procedurePath === "curriculum.submitQuiz") return quizResult;
  if (procedurePath === "curriculum.markLessonStarted") return null;
  if (procedurePath === "curriculum.getProfile") return null;
  return null;
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
  await page.route("**/api/trpc*", async (route) => {
    const url = new URL(route.request().url());

    // tRPC batch stream sends ?batch=1&0.procedure=...&1.procedure=...
    // Collect all procedure names from query params
    const procedures: string[] = [];
    for (const [key, value] of url.searchParams.entries()) {
      if (key.match(/^\d+\.procedure$/)) {
        procedures.push(value);
      }
    }

    // Fall back to URL-path style: /api/trpc/curriculum.list,curriculum.get
    if (procedures.length === 0) {
      const pathPart = url.pathname.split("/api/trpc/")[1];
      if (pathPart) procedures.push(...pathPart.split(","));
    }

    // If still nothing, try to determine from POST body
    if (procedures.length === 0 && route.request().method() === "POST") {
      try {
        const body = await route.request().postDataJSON();
        if (body && typeof body === "object") {
          // Body keys are indices; look for procedure hints in query or just return empty batch
          const indices = Object.keys(body).filter((k) => /^\d+$/.test(k));
          // We can't easily determine procedure from body alone without the query param,
          // so return null for all
          const results = indices.map(() => ({ result: { data: { json: null } } }));
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(results),
          });
        }
      } catch {
        // ignore parse errors
      }
    }

    const results = procedures.map((proc) => ({
      result: { data: { json: resolveData(proc, data) } },
    }));

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(results.length > 0 ? results : [{ result: { data: { json: null } } }]),
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
