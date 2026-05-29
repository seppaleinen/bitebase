import { describe, it, expect } from "vitest";
import { buildLessonSystemPrompt } from "../src/prompts/index";

const profile = {
  topic: "TypeScript",
  experienceLevel: "beginner" as const,
  goals: "Build production-ready apps",
  availableMinutesPerDay: 30,
};

const outline = [
  "1. [Foundations] Introduction to TypeScript",
  "2. [Foundations] Types and Interfaces",
  "3. [Advanced] Generics",
  "4. [Advanced] Decorators",
  "5. [Projects] Building a REST API",
].join("\n");

describe("buildLessonSystemPrompt", () => {
  it("includes the curriculum outline in the prompt", () => {
    const result = buildLessonSystemPrompt(
      profile,
      "Foundations",
      "Types and Interfaces",
      outline,
      "Some search results here.",
      2,
      5,
    );

    expect(result).toContain(outline);
  });

  it("includes the lesson position and total count", () => {
    const result = buildLessonSystemPrompt(
      profile,
      "Foundations",
      "Types and Interfaces",
      outline,
      "Some search results here.",
      2,
      5,
    );

    expect(result).toContain("#2");
    expect(result).toContain("5");
  });

  it("mentions the section and subsection titles", () => {
    const result = buildLessonSystemPrompt(
      profile,
      "Advanced Patterns",
      "Generics",
      outline,
      "",
      3,
      5,
    );

    expect(result).toContain("Advanced Patterns");
    expect(result).toContain("Generics");
  });

  it("includes the learner profile details", () => {
    const result = buildLessonSystemPrompt(
      profile,
      "Foundations",
      "Types and Interfaces",
      outline,
      "",
      1,
      5,
    );

    expect(result).toContain("TypeScript");
    expect(result).toContain("beginner");
    expect(result).toContain("Build production-ready apps");
  });

  it("includes the coherence instructions about not re-teaching earlier concepts", () => {
    const result = buildLessonSystemPrompt(
      profile,
      "Foundations",
      "Types and Interfaces",
      outline,
      "",
      2,
      5,
    );

    expect(result).toContain("Do NOT re-teach");
    expect(result).toContain("Do NOT introduce concepts that belong in later lessons");
  });
});
