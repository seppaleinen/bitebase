import { test as base, type Page, type Route } from "@playwright/test";

// ── Auth API mocks ─────────────────────────────────────────────────────────────

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

export async function mockAuth(page: Page) {
  await page.route("**/api/auth/get-session", (route) =>
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

// ── AI onboarding mock ─────────────────────────────────────────────────────────

type AIResponse =
  | "greeting"
  | "level"
  | "or-question"
  | "simple-ack"
  | "profile-marker";

const SSE_RESPONSES: Record<AIResponse, string> = {
  greeting:
    `0:"Hi! I'm BiteBase. What topic or skill would you like to learn today?"\n` +
    `e:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20},"isContinued":false}\n` +
    `d:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20}}\n`,

  level:
    `0:"Great! What's your experience level with this — beginner, intermediate, or advanced?"\n` +
    `e:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20},"isContinued":false}\n` +
    `d:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20}}\n`,

  "or-question":
    `0:"What aspects interest you most? Grammar or vocabulary?"\n` +
    `e:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20},"isContinued":false}\n` +
    `d:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":20}}\n`,

  "simple-ack":
    `0:"Got it! Let's move on."\n` +
    `e:{"finishReason":"stop","usage":{"promptTokens":5,"completionTokens":5},"isContinued":false}\n` +
    `d:{"finishReason":"stop","usage":{"promptTokens":5,"completionTokens":5}}\n`,

  "profile-marker":
    `0:"Here's your profile: PROFILE:{"topic":"Italian","experienceLevel":"Intermediate","goals":"Hold conversations"}"\n` +
    `e:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":30},"isContinued":false}\n` +
    `d:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":30}}\n`,
};

/**
 * Mock the onboarding chat endpoint with a configurable SSE response.
 * If `sequence` is provided, returns responses in order (repeats the last one).
 */
export async function mockAI(
  page: Page,
  responses: AIResponse | AIResponse[] = "greeting",
) {
  const sequence: AIResponse[] = Array.isArray(responses)
    ? responses.length > 0
      ? responses
      : ["greeting"]
    : [responses];

  let callCount = 0;

  await page.route("**/api/onboarding/chat", async (route: Route) => {
    const idx = Math.min(callCount++, sequence.length - 1);
    const key = sequence[idx] ?? ("greeting" as AIResponse);
    const body = SSE_RESPONSES[key];
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body,
    });
  });
}

// ── Generate endpoint mock ─────────────────────────────────────────────────────

export async function mockGenerate(page: Page) {
  const courseId = "mock-course-1";

  await page.route("**/api/onboarding/generate", async (route) => {
    const body = [
      `data: ${JSON.stringify({ event: "status", data: { message: "Saving your learning profile..." } })}\n\n`,
      `data: ${JSON.stringify({ event: "course_created", data: { courseId, title: "Test Curriculum", totalSections: 2 } })}\n\n`,
      `data: ${JSON.stringify({ event: "status", data: { message: "Creating lessons..." } })}\n\n`,
      `data: ${JSON.stringify({ event: "done", data: { courseId } })}\n\n`,
    ].join("");

    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body,
    });
  });
}

// ── tRPC mock ──────────────────────────────────────────────────────────────────

type TRPCMockData = {
  courses?: object[];
};

function resolveData(procedurePath: string, data: TRPCMockData): unknown {
  if (procedurePath === "course.list") return data.courses ?? [];
  return null;
}

export async function mockTRPC(page: Page, data: TRPCMockData = {}) {
  await page.route(/\/api\/trpc/, async (route: Route) => {
    const url = new URL(route.request().url());
    const pathPart = url.pathname.split("/api/trpc/")[1];
    const procedures = pathPart ? pathPart.split(",") : [];
    const results = procedures.map((proc: string) => ({
      result: { data: resolveData(proc, data) },
    }));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(results),
    });
  });
}

// ── Extended test fixture ──────────────────────────────────────────────────────

type BiteBaseFixtures = {
  authedPage: Page;
};

export const test = base.extend<BiteBaseFixtures>({
  authedPage: async ({ page }, use) => {
    await mockAuth(page);
    await mockTRPC(page);
    await use(page);
  },
});

export { expect, type Page } from "@playwright/test";
