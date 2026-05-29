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

  describe("quiz with unescaped control characters in JSON", () => {
    it("handles raw newlines inside quiz JSON string values", () => {
      const quizWithNewlines = `{"questions":[{"id":"q1","type":"multiple_choice","question":"What is\nnested?","options":["A","B"],"correctAnswer":"A","explanation":"OK"}],"passingScore":70}`;
      const result = parseLessonResponse(buildLesson({ quiz: quizWithNewlines }));
      expect(result.quiz.questions[0].id).toBe("q1");
    });
  });
});
