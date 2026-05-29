import { describe, it, expect } from "vitest";
import {
  learningProfileSchema,
  curriculumPlanSchema,
  quizQuestionSchema,
} from "../src/schemas/index";

// ─── learningProfileSchema ────────────────────────────────────────────────────

describe("learningProfileSchema", () => {
  const valid = {
    topic: "TypeScript",
    experienceLevel: "beginner" as const,
    goals: "Build production-ready apps",
    availableMinutesPerDay: 30,
  };

  it("accepts a complete valid profile", () => {
    expect(() => learningProfileSchema.parse(valid)).not.toThrow();
  });

  it("accepts all three experience levels", () => {
    for (const level of ["beginner", "intermediate", "advanced"] as const) {
      expect(() =>
        learningProfileSchema.parse({ ...valid, experienceLevel: level })
      ).not.toThrow();
    }
  });

  it("rejects an unknown experience level", () => {
    expect(() =>
      learningProfileSchema.parse({ ...valid, experienceLevel: "expert" })
    ).toThrow();
  });

  it("enforces availableMinutesPerDay minimum of 5", () => {
    expect(() =>
      learningProfileSchema.parse({ ...valid, availableMinutesPerDay: 4 })
    ).toThrow();
    expect(() =>
      learningProfileSchema.parse({ ...valid, availableMinutesPerDay: 5 })
    ).not.toThrow();
  });

  it("enforces availableMinutesPerDay maximum of 240", () => {
    expect(() =>
      learningProfileSchema.parse({ ...valid, availableMinutesPerDay: 241 })
    ).toThrow();
    expect(() =>
      learningProfileSchema.parse({ ...valid, availableMinutesPerDay: 240 })
    ).not.toThrow();
  });

  it("allows additionalContext to be omitted", () => {
    const { additionalContext: _, ...withoutContext } = {
      ...valid,
      additionalContext: "foo",
    };
    expect(() => learningProfileSchema.parse(withoutContext)).not.toThrow();
  });

  it("rejects a missing topic", () => {
    const { topic: _, ...noTopic } = valid;
    expect(() => learningProfileSchema.parse(noTopic)).toThrow();
  });

  it("rejects a missing goals field", () => {
    const { goals: _, ...noGoals } = valid;
    expect(() => learningProfileSchema.parse(noGoals)).toThrow();
  });
});

// ─── curriculumPlanSchema ─────────────────────────────────────────────────────

describe("curriculumPlanSchema", () => {
  const makeSection = (id: string, order: number) => ({
    id,
    title: `Section ${id}`,
    description: "desc",
    estimatedMinutes: 20,
    order,
    subsections: [
      { id: `sub-${id}-1`, title: "Sub 1", description: "d", order: 0 },
    ],
  });

  const valid = {
    title: "Learn TypeScript",
    description: "A complete TS course",
    totalEstimatedMinutes: 120,
    sections: [makeSection("s1", 0), makeSection("s2", 1), makeSection("s3", 2)],
  };

  it("accepts a valid plan with 3 sections", () => {
    expect(() => curriculumPlanSchema.parse(valid)).not.toThrow();
  });

  it("rejects fewer than 3 sections", () => {
    expect(() =>
      curriculumPlanSchema.parse({ ...valid, sections: [makeSection("s1", 0)] })
    ).toThrow();
  });

  it("rejects more than 8 sections", () => {
    const sections = Array.from({ length: 9 }, (_, i) =>
      makeSection(`s${i}`, i)
    );
    expect(() => curriculumPlanSchema.parse({ ...valid, sections })).toThrow();
  });

  it("accepts exactly 8 sections", () => {
    const sections = Array.from({ length: 8 }, (_, i) =>
      makeSection(`s${i}`, i)
    );
    expect(() => curriculumPlanSchema.parse({ ...valid, sections })).not.toThrow();
  });
});

// ─── quizQuestionSchema ───────────────────────────────────────────────────────

describe("quizQuestionSchema", () => {
  const mcQuestion = {
    id: "q1",
    type: "multiple_choice" as const,
    question: "What is TypeScript?",
    options: ["A", "B", "C", "D"],
    correctAnswer: "A",
    explanation: "TypeScript is a typed superset of JavaScript.",
  };

  it("accepts a valid multiple choice question", () => {
    expect(() => quizQuestionSchema.parse(mcQuestion)).not.toThrow();
  });

  it("accepts multiple choice options with 2-6 items", () => {
    // Relaxed from strict 4 so minor model over/under-generation doesn't fail the whole schema
    expect(() =>
      quizQuestionSchema.parse({ ...mcQuestion, options: ["A", "B", "C"] })
    ).not.toThrow();
    expect(() =>
      quizQuestionSchema.parse({ ...mcQuestion, options: ["A", "B", "C", "D", "E"] })
    ).not.toThrow();
  });

  it("rejects multiple choice options with fewer than 2 or more than 6 items", () => {
    expect(() =>
      quizQuestionSchema.parse({ ...mcQuestion, options: ["A"] })
    ).toThrow();
    expect(() =>
      quizQuestionSchema.parse({ ...mcQuestion, options: ["A", "B", "C", "D", "E", "F", "G"] })
    ).toThrow();
  });

  it("accepts a fill_in_blank question without options", () => {
    const { options: _, ...fillIn } = {
      ...mcQuestion,
      type: "fill_in_blank" as const,
    };
    expect(() => quizQuestionSchema.parse(fillIn)).not.toThrow();
  });

  it("rejects an unknown question type", () => {
    expect(() =>
      quizQuestionSchema.parse({ ...mcQuestion, type: "true_false" })
    ).toThrow();
  });

  it("rejects a missing explanation", () => {
    const { explanation: _, ...noExplanation } = mcQuestion;
    expect(() => quizQuestionSchema.parse(noExplanation)).toThrow();
  });
});
