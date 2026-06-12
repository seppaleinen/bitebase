import { describe, it, expect } from "vitest";
import { buildNarrativeThreads } from "../src/lib/narrative-thread";
import type { CurriculumPlan } from "../src/schemas";

describe("buildNarrativeThreads", () => {
  const samplePlan: CurriculumPlan = {
    title: "TypeScript Fundamentals",
    description: "Learn TypeScript from the ground up",
    totalEstimatedMinutes: 120,
    sections: [
      {
        id: "section-1",
        title: "Getting Started",
        description: "Install tools and write your first TypeScript program",
        order: 0,
        estimatedMinutes: 20,
        subsections: [
          {
            id: "sub-1-a",
            title: "What is TypeScript?",
            description: "Overview of TypeScript and its benefits over plain JavaScript",
            order: 0,
          },
          {
            id: "sub-1-b",
            title: "Setting Up Your Environment",
            description: "Install Node.js, npm, and the TypeScript compiler",
            order: 1,
          },
        ],
      },
      {
        id: "section-2",
        title: "Core Concepts",
        description: "Fundamental type system concepts",
        order: 1,
        estimatedMinutes: 40,
        subsections: [
          {
            id: "sub-2-a",
            title: "Basic Types",
            description: "Learn about string, number, boolean, and type inference",
            order: 0,
          },
          {
            id: "sub-2-b",
            title: "Functions and Interfaces",
            description: "Define function signatures and object shapes with interfaces",
            order: 1,
          },
        ],
      },
    ],
  };

  it("returns one thread per flattened lesson", () => {
    const threads = buildNarrativeThreads(samplePlan);
    expect(threads).toHaveLength(4);
  });

  it("first lesson sets the stage with no prior knowledge assumption", () => {
    const threads = buildNarrativeThreads(samplePlan);
    expect(threads[0]).toMatch(/first lesson/);
    expect(threads[0]).toContain('"What is TypeScript?"');
    expect(threads[0]).toContain("no prior knowledge");
  });

  it("subsequent lessons reference the previous lesson", () => {
    const threads = buildNarrativeThreads(samplePlan);
    // Second lesson (order 1) references first lesson (order 0)
    expect(threads[1]).toContain('previous lesson about "What is TypeScript?"');
    expect(threads[1]).toContain('"Setting Up Your Environment"');
    // Third lesson references second lesson
    expect(threads[2]).toContain('previous lesson about "Setting Up Your Environment"');
    expect(threads[2]).toContain('"Basic Types"');
  });

  it("includes subsection descriptions in lower case within threads", () => {
    const threads = buildNarrativeThreads(samplePlan);
    // First thread: "overview of TypeScript..." (first char lowered, rest preserved)
    expect(threads[0]).toContain("overview of TypeScript");
    // Second thread references first lesson's description in lower case
    expect(threads[1]).toContain("overview of TypeScript");
    // And introduces its own topic
    expect(threads[1]).toContain("install Node.js, npm, and the TypeScript compiler");
  });

  it("handles single section with single lesson", () => {
    const single: CurriculumPlan = {
      title: "Quick Topic",
      description: "Just one lesson",
      totalEstimatedMinutes: 10,
      sections: [
        {
          id: "section-1",
          title: "The Only Section",
          description: "A single section",
          order: 0,
          estimatedMinutes: 10,
          subsections: [
            {
              id: "sub-1-a",
              title: "The Only Lesson",
              description: "Just this one lesson",
              order: 0,
            },
          ],
        },
      ],
    };
    const threads = buildNarrativeThreads(single);
    expect(threads).toHaveLength(1);
    expect(threads[0]).toContain("first lesson");
    expect(threads[0]).toContain('"The Only Lesson"');
  });

  it("returns empty array for empty course", () => {
    const empty: CurriculumPlan = {
      title: "Empty",
      description: "No sections",
      totalEstimatedMinutes: 0,
      sections: [],
    };
    expect(buildNarrativeThreads(empty)).toEqual([]);
  });

  it("handles section boundary transitions naturally", () => {
    const threads = buildNarrativeThreads(samplePlan);
    // Lesson at index 2 is the first lesson of section "Core Concepts"
    // It should reference lesson at index 1 ("Setting Up Your Environment")
    expect(threads[2]).toContain('previous lesson about "Setting Up Your Environment"');
    expect(threads[2]).toContain('"Basic Types"');
    expect(threads[2]).toContain("learn about string, number, boolean, and type inference");
  });

  it("returns deterministic results (same input = same output)", () => {
    const a = buildNarrativeThreads(samplePlan);
    const b = buildNarrativeThreads(samplePlan);
    expect(a).toEqual(b);
  });
});
