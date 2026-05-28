import { describe, it, expect } from "vitest";
import { scoreQuiz } from "../src/lib/quiz-scoring";
import type { QuizQuestion } from "@bitebase/db";

function makeQuestion(id: string, correctAnswer: string): QuizQuestion {
  return {
    id,
    type: "multiple_choice",
    question: `Question ${id}`,
    options: ["A", "B", "C", "D"],
    correctAnswer,
    explanation: `Explanation for ${id}`,
  };
}

const PASSING_SCORE = 70;

const questions: QuizQuestion[] = [
  makeQuestion("q1", "A"),
  makeQuestion("q2", "B"),
  makeQuestion("q3", "C"),
];

describe("scoreQuiz", () => {
  describe("score calculation", () => {
    it("returns 100% when all answers are correct", () => {
      const result = scoreQuiz(
        questions,
        { q1: "A", q2: "B", q3: "C" },
        PASSING_SCORE
      );
      expect(result.score).toBe(100);
      expect(result.correct).toBe(3);
      expect(result.total).toBe(3);
    });

    it("returns 0% when all answers are wrong", () => {
      const result = scoreQuiz(
        questions,
        { q1: "X", q2: "X", q3: "X" },
        PASSING_SCORE
      );
      expect(result.score).toBe(0);
      expect(result.correct).toBe(0);
    });

    it("rounds to nearest integer (2/3 = 67%)", () => {
      const result = scoreQuiz(
        questions,
        { q1: "A", q2: "B", q3: "WRONG" },
        PASSING_SCORE
      );
      expect(result.score).toBe(67);
      expect(result.correct).toBe(2);
    });

    it("returns 0 when no answers are provided", () => {
      const result = scoreQuiz(questions, {}, PASSING_SCORE);
      expect(result.score).toBe(0);
      expect(result.correct).toBe(0);
    });

    it("returns 0 when the question list is empty", () => {
      const result = scoreQuiz([], {}, PASSING_SCORE);
      expect(result.score).toBe(0);
      expect(result.total).toBe(0);
    });
  });

  describe("pass / fail threshold", () => {
    it("passes at exactly the passing score", () => {
      // 3 questions, need 70% → need ceil(2.1) = 3 correct out of 3 isn't 70, 
      // Use 10 questions so boundary is clean at 7/10 = 70%
      const qs = Array.from({ length: 10 }, (_, i) =>
        makeQuestion(`q${i}`, "A")
      );
      const answers = Object.fromEntries(
        qs.slice(0, 7).map((q) => [q.id, "A"]) // 7 correct
      );
      const result = scoreQuiz(qs, answers, 70);
      expect(result.score).toBe(70);
      expect(result.passed).toBe(true);
    });

    it("fails one point below the passing score", () => {
      const qs = Array.from({ length: 10 }, (_, i) =>
        makeQuestion(`q${i}`, "A")
      );
      const answers = Object.fromEntries(
        qs.slice(0, 6).map((q) => [q.id, "A"]) // 6 correct = 60%
      );
      const result = scoreQuiz(qs, answers, 70);
      expect(result.score).toBe(60);
      expect(result.passed).toBe(false);
    });

    it("respects a custom passing score", () => {
      const result = scoreQuiz(
        questions,
        { q1: "A", q2: "B", q3: "WRONG" }, // 67%
        50 // custom lower threshold
      );
      expect(result.passed).toBe(true);
    });
  });

  describe("feedback", () => {
    it("marks each question correct or incorrect", () => {
      const result = scoreQuiz(
        questions,
        { q1: "A", q2: "WRONG", q3: "C" },
        PASSING_SCORE
      );
      const byId = Object.fromEntries(
        result.feedback.map((f) => [f.questionId, f])
      );

      expect(byId.q1.correct).toBe(true);
      expect(byId.q2.correct).toBe(false);
      expect(byId.q3.correct).toBe(true);
    });

    it("includes the correct answer and explanation in every feedback item", () => {
      const result = scoreQuiz(
        questions,
        { q1: "A", q2: "B", q3: "C" },
        PASSING_SCORE
      );
      for (const item of result.feedback) {
        expect(item.correctAnswer).toBeTruthy();
        expect(item.explanation).toBeTruthy();
      }
    });

    it("returns one feedback item per question", () => {
      const result = scoreQuiz(questions, {}, PASSING_SCORE);
      expect(result.feedback).toHaveLength(questions.length);
    });
  });
});
