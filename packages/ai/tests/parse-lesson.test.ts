import { describe, it, expect } from "vitest";
import { parseLessonResponse } from "../src/lib/parse-lesson";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildLesson({
  content = "# Hello\n\nLesson body.",
  minutes = "15",
  sources = "[]",
  quiz = JSON.stringify({
    questions: [
      {
        id: "q1",
        type: "multiple_choice",
        question: "What is 2+2?",
        options: ["1", "2", "3", "4"],
        correctAnswer: "4",
        explanation: "Basic arithmetic.",
      },
    ],
    passingScore: 70,
  }),
}: {
  content?: string;
  minutes?: string;
  sources?: string;
  quiz?: string;
} = {}): string {
  const parts: string[] = [];
  parts.push(`===CONTENT===\n${content}`);
  parts.push(`===MINUTES===\n${minutes}`);
  parts.push(`===SOURCES===\n${sources}`);
  parts.push(`===QUIZ===\n${quiz}`);
  return parts.join("\n");
}

// ─── parseLessonResponse ──────────────────────────────────────────────────────

describe("parseLessonResponse", () => {
  describe("valid separator input", () => {
    it("returns the correct content string", () => {
      const result = parseLessonResponse(buildLesson({ content: "# My Lesson\n\nGreat content." }));
      expect(result.content).toBe("# My Lesson\n\nGreat content.");
    });

    it("returns the correct estimatedMinutes", () => {
      const result = parseLessonResponse(buildLesson({ minutes: "25" }));
      expect(result.estimatedMinutes).toBe(25);
    });

    it("returns parsed sources array", () => {
      const sources = JSON.stringify([{ title: "MDN", url: "https://developer.mozilla.org" }]);
      const result = parseLessonResponse(buildLesson({ sources }));
      expect(result.sources).toEqual([{ title: "MDN", url: "https://developer.mozilla.org" }]);
    });

    it("returns the quiz with questions and passingScore", () => {
      const result = parseLessonResponse(buildLesson());
      expect(result.quiz.questions).toHaveLength(1);
      expect(result.quiz.questions[0].id).toBe("q1");
      expect(result.quiz.passingScore).toBe(70);
    });

    it("strips markdown code fences around the quiz JSON", () => {
      const fenced = "```json\n" + JSON.stringify({ questions: [], passingScore: 80 }) + "\n```";
      const result = parseLessonResponse(buildLesson({ quiz: fenced }));
      expect(result.quiz.passingScore).toBe(80);
    });

    it("defaults estimatedMinutes to 10 when the MINUTES section is not a number", () => {
      const result = parseLessonResponse(buildLesson({ minutes: "about fifteen" }));
      expect(result.estimatedMinutes).toBe(10);
    });

    it("clamps estimatedMinutes to 1 minimum when a negative number is given", () => {
      // parseInt("-5") = -5; -5 || 10 = -5 (truthy); Math.max(1, -5) = 1
      const result = parseLessonResponse(buildLesson({ minutes: "-5" }));
      expect(result.estimatedMinutes).toBe(1);
    });

    it("handles section separators with extra spaces (=== CONTENT ===)", () => {
      const text = "=== CONTENT ===\nHello world\n=== MINUTES ===\n5\n=== SOURCES ===\n[]\n=== QUIZ ===\n{}";
      const result = parseLessonResponse(text);
      expect(result.content).toBe("Hello world");
      expect(result.estimatedMinutes).toBe(5);
    });
  });

  describe("missing QUIZ section (regression)", () => {
    it("returns empty questions array without throwing when QUIZ is absent", () => {
      const text = "===CONTENT===\nLesson content here.\n===MINUTES===\n10\n===SOURCES===\n[]";
      const result = parseLessonResponse(text);
      expect(result.quiz.questions).toEqual([]);
      expect(result.quiz.passingScore).toBe(70);
    });
  });

  describe("malformed SOURCES JSON (regression)", () => {
    it("falls back to empty array when SOURCES is not valid JSON", () => {
      const result = parseLessonResponse(buildLesson({ sources: "not-json-at-all" }));
      expect(result.sources).toEqual([]);
    });

    it("falls back to empty array when SOURCES is a partial JSON string", () => {
      const result = parseLessonResponse(buildLesson({ sources: '[{"title": "broken"' }));
      expect(result.sources).toEqual([]);
    });

    it("falls back to empty array when SOURCES is a JSON object instead of array", () => {
      const result = parseLessonResponse(buildLesson({ sources: '{"title": "MDN"}' }));
      expect(result.sources).toEqual([]);
    });
  });

  describe("decorated separators (model writes === 🎯 Title === instead of ===CONTENT===)", () => {
    it("handles emoji title as first separator — replaces with ===CONTENT===", () => {
      const text = "=== 🎯 Quantum Field Theory ===\n\nLesson body here.\n\n===MINUTES===\n12\n===SOURCES===\n[]\n===QUIZ===\n{}";
      const result = parseLessonResponse(text);
      expect(result.content).toBe("Lesson body here.");
      expect(result.estimatedMinutes).toBe(12);
    });

    it("handles === Title === with text only (no emoji)", () => {
      const text = "=== Introduction ===\n\nSome content.\n\n===MINUTES===\n8\n===SOURCES===\n[]\n===QUIZ===\n{\"questions\":[],\"passingScore\":70}";
      const result = parseLessonResponse(text);
      expect(result.content).toBe("Some content.");
      expect(result.estimatedMinutes).toBe(8);
    });

    it("handles === ⏰ MINUTES === decorated separator", () => {
      const text = "===CONTENT===\nHello\n=== ⏰ MINUTES ===\n5\n===SOURCES===\n[]\n===QUIZ===\n{}";
      const result = parseLessonResponse(text);
      expect(result.content).toBe("Hello");
      expect(result.estimatedMinutes).toBe(5);
    });

    it("handles === 🎯 CONTENT === decorated separator", () => {
      const text = "=== 🎯 CONTENT ===\nContent body\n===MINUTES===\n3\n===SOURCES===\n[]\n===QUIZ===\n{}";
      const result = parseLessonResponse(text);
      expect(result.content).toBe("Content body");
    });

    it("still throws when no ===...=== block exists at all", () => {
      expect(() => parseLessonResponse("Just some text with no separators")).toThrow(
        "No ===CONTENT=== section found"
      );
    });
  });

  describe("missing CONTENT section (regression)", () => {
    it("throws when the CONTENT section is absent", () => {
      const text = "===MINUTES===\n10\n===SOURCES===\n[]\n===QUIZ===\n{}";
      expect(() => parseLessonResponse(text)).toThrow(
        "No ===CONTENT=== section found in lesson response"
      );
    });

    it("throws when the CONTENT section is present but empty", () => {
      const text = "===CONTENT===\n\n===MINUTES===\n10\n===SOURCES===\n[]\n===QUIZ===\n{}";
      expect(() => parseLessonResponse(text)).toThrow(
        "No ===CONTENT=== section found in lesson response"
      );
    });
  });

  describe("multi-paragraph CONTENT section", () => {
    it("correctly extracts a realistic multi-paragraph lesson body (≥200 chars)", () => {
      const multiParaContent = [
        "# Basic Greetings in French",
        "",
        "## Introduction",
        "",
        "Learning greetings is the first step in any language. In French, there are",
        "several ways to say hello depending on the context and time of day.",
        "",
        "## Common Greetings",
        "",
        "Here are the most essential French greetings you will encounter every day:",
        "",
        "- **Bonjour** — Hello / Good morning (formal, used during the day)",
        "- **Bonsoir** — Good evening (used after around 6 pm)",
        "- **Salut** — Hi / Bye (informal, used with friends)",
        "- **Bonne nuit** — Good night (said when parting at night)",
        "",
        "## Practical Examples",
        "",
        "When meeting someone for the first time at work, say: *Bonjour, je m'appelle Marie.*",
        "(Hello, my name is Marie.) With a friend, you would say: *Salut, ça va?*",
        "(Hi, how are you?) Responding positively: *Ça va bien, merci!* (I'm doing well, thanks!)",
        "",
        "## Key Takeaways",
        "",
        "Remember: use *Bonjour* in formal settings and *Salut* only with people you know well.",
      ].join("\n");

      const result = parseLessonResponse(buildLesson({ content: multiParaContent }));

      expect(result.content).toBe(multiParaContent);
      expect(result.content.trim().length).toBeGreaterThanOrEqual(200);
      expect(result.content).toContain("## Introduction");
      expect(result.content).toContain("## Common Greetings");
      expect(result.content).toContain("## Practical Examples");
      expect(result.content).toContain("Bonjour");
    });
  });

  describe("quiz with unescaped control characters in JSON", () => {
    it("handles raw newlines inside quiz JSON string values", () => {
      const quizWithNewlines = `{"questions":[{"id":"q1","type":"multiple_choice","question":"What is\nnested?","options":["A","B"],"correctAnswer":"A","explanation":"OK"}],"passingScore":70}`;
      const result = parseLessonResponse(buildLesson({ quiz: quizWithNewlines }));
      expect(result.quiz.questions[0].id).toBe("q1");
    });
  });

  describe("repairJson — fixes common LLM JSON defects in quiz section", () => {
    it("parses quiz JSON with trailing comma in array", () => {
      const quizJson = `{"questions":[{"id":"q1","type":"multiple_choice","question":"Test?","options":["A","B","C","D",],"correctAnswer":"A","explanation":"OK"}],"passingScore":70}`;
      const result = parseLessonResponse(buildLesson({ quiz: quizJson }));
      expect(result.quiz.questions).toHaveLength(1);
      expect(result.quiz.questions[0].id).toBe("q1");
      expect(result.quiz.passingScore).toBe(70);
    });

    it("parses quiz JSON with trailing comma in object", () => {
      const quizJson = `{"questions":[{"id":"q1","type":"multiple_choice","question":"Test?","options":["A","B","C","D"],"correctAnswer":"A","explanation":"OK",}],"passingScore":70}`;
      const result = parseLessonResponse(buildLesson({ quiz: quizJson }));
      expect(result.quiz.questions).toHaveLength(1);
      expect(result.quiz.questions[0].id).toBe("q1");
    });

    it("parses quiz JSON truncated at the array boundary (missing final braces)", () => {
      const quizJson = `{"questions":[{"id":"q1","type":"multiple_choice","question":"Test?","options":["A","B","C","D"],"correctAnswer":"A","explanation":"OK"}]`;
      const result = parseLessonResponse(buildLesson({ quiz: quizJson }));
      expect(result.quiz.questions).toHaveLength(1);
      expect(result.quiz.questions[0].id).toBe("q1");
    });

    it("parses quiz JSON with extra trailing text after closing brace", () => {
      const quizJson = `{"questions":[{"id":"q1","type":"multiple_choice","question":"Test?","options":["A","B","C","D"],"correctAnswer":"A","explanation":"OK"}],"passingScore":70} And here is some extra text the model added`;
      const result = parseLessonResponse(buildLesson({ quiz: quizJson }));
      expect(result.quiz.questions).toHaveLength(1);
      expect(result.quiz.questions[0].id).toBe("q1");
    });

    it("parses quiz JSON with multiple defects: trailing comma + extra text", () => {
      const quizJson = `{"questions":[{"id":"q1","type":"multiple_choice","question":"Test?","options":["A","B",],"correctAnswer":"A","explanation":"OK",}],"passingScore":70} The quiz above tests the core concepts.`;
      const result = parseLessonResponse(buildLesson({ quiz: quizJson }));
      expect(result.quiz.questions).toHaveLength(1);
      expect(result.quiz.questions[0].id).toBe("q1");
    });
  });
});
