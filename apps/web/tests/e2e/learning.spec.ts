import { test, expect, mockTRPC, mockAI, setTestSession } from "./fixtures";

// ── Shared fixtures ────────────────────────────────────────────────────────────

const mockCurriculum = {
  id: "curr-1",
  userId: "playwright-test-user",
  profileId: "prof-1",
  title: "Intro to TypeScript",
  description: "A complete TypeScript curriculum for beginners.",
  totalEstimatedMinutes: 120,
  sections: [
    {
      id: "sec-1",
      title: "Basics",
      description: "TypeScript fundamentals",
      estimatedMinutes: 30,
      order: 0,
      subsections: [
        {
          id: "sub-1",
          title: "Types and Interfaces",
          description: "Learn TS types",
          order: 0,
        },
      ],
    },
  ],
  generationStatus: "complete",
  createdAt: new Date().toISOString(),
};

const mockLesson = {
  id: "lesson-1",
  curriculumId: "curr-1",
  sectionId: "sec-1",
  subsectionId: "sub-1",
  title: "Types and Interfaces",
  content: `# Types and Interfaces\n\nTypeScript adds static typing to JavaScript.\n\n## Basic Types\n\nUse \`string\`, \`number\`, \`boolean\` for primitive types.\n\n\`\`\`typescript\nconst name: string = "Alice";\n\`\`\`\n\n## Interfaces\n\nInterfaces define the shape of objects.\n\n\`\`\`typescript\ninterface User {\n  id: number;\n  name: string;\n}\n\`\`\``,
  sources: [{ title: "TypeScript Docs", url: "https://www.typescriptlang.org" }],
  estimatedMinutes: 15,
  order: 0,
  createdAt: new Date().toISOString(),
};

const mockQuiz = {
  id: "quiz-1",
  lessonId: "lesson-1",
  questions: [
    {
      id: "q1",
      type: "multiple_choice",
      question: "Which keyword declares a TypeScript interface?",
      options: ["class", "interface", "type", "struct"],
      correctAnswer: "interface",
      explanation: "The `interface` keyword defines a contract for object shapes.",
    },
    {
      id: "q2",
      type: "multiple_choice",
      question: "What is the TypeScript type for text values?",
      options: ["text", "varchar", "string", "str"],
      correctAnswer: "string",
      explanation: "`string` is the TypeScript primitive type for text.",
    },
    {
      id: "q3",
      type: "multiple_choice",
      question: "TypeScript is a superset of which language?",
      options: ["Java", "Python", "JavaScript", "Ruby"],
      correctAnswer: "JavaScript",
      explanation: "TypeScript extends JavaScript with optional static typing.",
    },
  ],
  passingScore: 70,
  createdAt: new Date().toISOString(),
};

const mockProgress = {
  id: "prog-1",
  userId: "playwright-test-user",
  lessonId: "lesson-1",
  status: "available" as const,
  quizScore: null,
  quizPassed: null,
  quizAttempts: 0,
  completedAt: null,
  lastAccessedAt: new Date().toISOString(),
};

// ── Dashboard ─────────────────────────────────────────────────────────────────

test.describe("Dashboard", () => {
  test("shows empty state when user has no curricula", async ({ page }) => {
    await setTestSession(page);
    await mockTRPC(page, { curricula: [] });
    await page.goto("/dashboard");

    await expect(page.getByText(/no courses yet/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: /create my first course/i })
    ).toBeVisible();
  });

  test("shows curriculum cards when curricula exist", async ({ page }) => {
    await setTestSession(page);
    await mockTRPC(page, {
      curricula: [mockCurriculum],
      lessons: [],
    });
    await page.goto("/dashboard");

    await expect(page.getByText("Intro to TypeScript")).toBeVisible();
    await expect(page.getByText(/2h total/i)).toBeVisible();
  });

  test("'New course' button navigates to /onboarding", async ({ page }) => {
    await setTestSession(page);
    await mockTRPC(page, { curricula: [] });
    await page.goto("/dashboard");

    await page.getByRole("link", { name: /new course/i }).first().click();
    await expect(page).toHaveURL(/\/onboarding/);
  });
});

// ── Onboarding ────────────────────────────────────────────────────────────────

test.describe("Onboarding chat", () => {
  test("renders the initial welcome message", async ({ page }) => {
    await setTestSession(page);
    await mockAI(page);
    await page.goto("/onboarding");

    await expect(
      page.getByText(/what topic or skill have you been wanting to learn/i)
    ).toBeVisible();
  });

  test("message input and send button are visible", async ({ page }) => {
    await setTestSession(page);
    await mockAI(page);
    await page.goto("/onboarding");

    await expect(page.getByPlaceholder(/type your message/i)).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
  });
});

// ── Lesson page ───────────────────────────────────────────────────────────────

test.describe("Lesson page", () => {
  async function setupLesson(page: Parameters<typeof mockTRPC>[0]) {
    await setTestSession(page);
    await mockTRPC(page, {
      lesson: mockLesson,
      quiz: mockQuiz,
      progress: mockProgress,
    });
  }

  test("renders lesson title and content", async ({ page }) => {
    await setupLesson(page);
    await page.goto("/lesson/lesson-1");

    await expect(
      page.getByRole("heading", { name: "Types and Interfaces" })
    ).toBeVisible();
    await expect(
      page.getByText("TypeScript adds static typing")
    ).toBeVisible();
  });

  test("shows estimated read time badge", async ({ page }) => {
    await setupLesson(page);
    await page.goto("/lesson/lesson-1");
    await expect(page.getByText(/15 min read/i)).toBeVisible();
  });

  test("shows sources section with links", async ({ page }) => {
    await setupLesson(page);
    await page.goto("/lesson/lesson-1");

    await expect(page.getByText(/sources & further reading/i)).toBeVisible();
    await expect(page.getByRole("link", { name: "TypeScript Docs" })).toBeVisible();
  });

  test("shows quiz prompt CTA after lesson content", async ({ page }) => {
    await setupLesson(page);
    await page.goto("/lesson/lesson-1");

    await expect(page.getByText(/ready to test your knowledge/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /take the quiz/i })
    ).toBeVisible();
  });

  test("back link navigates to curriculum", async ({ page }) => {
    await setupLesson(page);
    await page.goto("/lesson/lesson-1");

    await expect(
      page.getByRole("link", { name: /back to curriculum/i })
    ).toBeVisible();
  });
});

// ── Quiz engine ───────────────────────────────────────────────────────────────

test.describe("Quiz engine", () => {
  async function setupQuiz(page: Parameters<typeof mockTRPC>[0], quizResult?: object) {
    await setTestSession(page);
    await mockTRPC(page, {
      lesson: mockLesson,
      quiz: mockQuiz,
      progress: mockProgress,
      quizResult: quizResult ?? null,
    });
  }

  test("quiz shows first question after clicking 'Take the quiz'", async ({
    page,
  }) => {
    await setupQuiz(page);
    await page.goto("/lesson/lesson-1");

    await page.getByRole("button", { name: /take the quiz/i }).click();

    await expect(
      page.getByText(/which keyword declares a typescript interface/i)
    ).toBeVisible();
    await expect(page.getByText(/question 1 of 3/i)).toBeVisible();
  });

  test("selecting an answer enables the Next button", async ({ page }) => {
    await setupQuiz(page);
    await page.goto("/lesson/lesson-1");
    await page.getByRole("button", { name: /take the quiz/i }).click();

    const nextBtn = page.getByRole("button", { name: /next/i });
    await expect(nextBtn).toBeDisabled();

    await page.getByText("interface").click();
    await expect(nextBtn).toBeEnabled();
  });

  test("advancing through questions updates the progress indicator", async ({
    page,
  }) => {
    await setupQuiz(page);
    await page.goto("/lesson/lesson-1");
    await page.getByRole("button", { name: /take the quiz/i }).click();

    await page.getByText("interface").click();
    await page.getByRole("button", { name: /next/i }).click();

    await expect(page.getByText(/question 2 of 3/i)).toBeVisible();
  });

  test("passing the quiz shows the success trophy screen", async ({ page }) => {
    const passingResult = {
      score: 100,
      passed: true,
      correct: 3,
      total: 3,
      feedback: mockQuiz.questions.map((q) => ({
        questionId: q.id,
        correct: true,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      })),
    };
    await setupQuiz(page, passingResult);
    await page.goto("/lesson/lesson-1");
    await page.getByRole("button", { name: /take the quiz/i }).click();

    await page.getByText("interface").click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByText("string").click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByText("JavaScript").click();
    await page.getByRole("button", { name: /submit quiz/i }).click();

    await expect(page.getByText(/lesson complete/i)).toBeVisible();
    await expect(page.getByText(/100%/)).toBeVisible();
  });

  test("failing the quiz shows the retry screen", async ({ page }) => {
    const failingResult = {
      score: 33,
      passed: false,
      correct: 1,
      total: 3,
      feedback: mockQuiz.questions.map((q, i) => ({
        questionId: q.id,
        correct: i === 0,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
      })),
    };
    await setupQuiz(page, failingResult);
    await page.goto("/lesson/lesson-1");
    await page.getByRole("button", { name: /take the quiz/i }).click();

    await page.getByText("interface").click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByText("string").click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByText("JavaScript").click();
    await page.getByRole("button", { name: /submit quiz/i }).click();

    await expect(page.getByText(/not quite there yet/i)).toBeVisible();
    await expect(page.getByText(/33%/)).toBeVisible();
    await expect(page.getByRole("button", { name: /retake quiz/i })).toBeVisible();
  });

  test("'Review answers' reveals per-question feedback", async ({ page }) => {
    const failingResult = {
      score: 33,
      passed: false,
      correct: 1,
      total: 3,
      feedback: [
        {
          questionId: "q1",
          correct: true,
          correctAnswer: "interface",
          explanation: "interface keyword.",
        },
        {
          questionId: "q2",
          correct: false,
          correctAnswer: "string",
          explanation: "string is correct.",
        },
        {
          questionId: "q3",
          correct: false,
          correctAnswer: "JavaScript",
          explanation: "JS superset.",
        },
      ],
    };
    await setupQuiz(page, failingResult);
    await page.goto("/lesson/lesson-1");
    await page.getByRole("button", { name: /take the quiz/i }).click();

    await page.getByText("interface").click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByText("string").click();
    await page.getByRole("button", { name: /next/i }).click();
    await page.getByText("JavaScript").click();
    await page.getByRole("button", { name: /submit quiz/i }).click();

    await page.getByRole("button", { name: /review answers/i }).click();

    await expect(page.getByText("Correct: string")).toBeVisible();
    await expect(page.getByText("Correct: JavaScript")).toBeVisible();
  });
});
