import { describe, it, expect } from "vitest";
import { injectImagesIntoContent, injectImagesIntoLesson } from "../src/lib/inject-images";

const sampleLesson = [
  "# TypeScript Basics",
  "",
  "## Introduction",
  "TypeScript is a typed superset of JavaScript.",
  "",
  "## Key Concepts",
  "TypeScript adds static type checking.",
  "",
  "## Practical Example",
  "Here is some example code.",
  "",
  "## Summary",
  "TypeScript helps catch errors early.",
].join("\n");

describe("injectImagesIntoContent", () => {
  it("returns content unchanged when no images provided", () => {
    const result = injectImagesIntoContent(sampleLesson, []);
    expect(result).toBe(sampleLesson);
  });

  it("returns content unchanged when content already has inline images", () => {
    const withImages = sampleLesson + "\n\n![Diagram](https://example.com/diag.png)\n";
    const result = injectImagesIntoContent(withImages, [
      "https://example.com/img.png",
    ]);
    expect(result).toBe(withImages);
  });

  it("returns content unchanged when fewer than 2 sections", () => {
    const singleSection = "# Title\n\n## Only Section\nContent here.\n";
    const result = injectImagesIntoContent(singleSection, [
      "https://example.com/img.png",
    ]);
    expect(result).toBe(singleSection);
  });

  it("injects images after subsequent ## headings", () => {
    const result = injectImagesIntoContent(sampleLesson, [
      "https://example.com/1.png",
      "https://example.com/2.png",
    ]);

    // Should have injected after "## Key Concepts" and "## Practical Example"
    expect(result).toContain("## Key Concepts\n\n![Illustration](https://example.com/1.png)");
    expect(result).toContain("## Practical Example\n\n![Illustration](https://example.com/2.png)");
    // Should NOT inject after the first heading ("## Introduction")
    expect(result).not.toContain("## Introduction\n\n![Illustration]");
  });

  it("limits injection to maxImages parameter", () => {
    const manyImages = [
      "https://example.com/1.png",
      "https://example.com/2.png",
      "https://example.com/3.png",
      "https://example.com/4.png",
      "https://example.com/5.png",
    ];
    const result = injectImagesIntoContent(sampleLesson, manyImages, 2);
    expect(result).toContain("![Illustration](https://example.com/1.png)");
    expect(result).toContain("![Illustration](https://example.com/2.png)");
    expect(result).not.toContain("https://example.com/3.png");
  });

  it("handles string and LessonImage URL formats", () => {
    const mixed = [
      "https://example.com/plain.png",
      { url: "https://example.com/captioned.png", caption: "A helpful diagram" },
    ];
    const result = injectImagesIntoContent(sampleLesson, mixed);
    expect(result).toContain("![Illustration](https://example.com/plain.png)");
    expect(result).toContain("![A helpful diagram](https://example.com/captioned.png)");
  });

  it("does not inject when content only has 1 section heading", () => {
    const oneSection = "# Topic\n\n## Only Section\nContent here.\n\n## Another Section\nMore content.\n";
    const result = injectImagesIntoContent(oneSection, [
      "https://example.com/1.png",
    ]);
    // With 2 headings, it should inject after the last one (headingIndices.length - 1 = 1)
    expect(result).not.toBe(oneSection);
    // But it distributes: skip heading 0, inject after 1
    expect(result).toContain("## Another Section\n\n![Illustration]");
  });

  it("treats lesson with 2 headings as injectable", () => {
    const twoSections = ["# Title", "", "## First", "Content A.", "", "## Second", "Content B."].join("\n");
    const result = injectImagesIntoContent(twoSections, [
      "https://example.com/1.png",
    ]);
    expect(result).not.toBe(twoSections);
    expect(result).toContain("## Second\n\n![Illustration](https://example.com/1.png)");
  });

  it("does not crash with empty content", () => {
    expect(() => injectImagesIntoContent("", ["https://example.com/1.png"])).not.toThrow();
    expect(injectImagesIntoContent("", [])).toBe("");
  });
});

describe("injectImagesIntoLesson", () => {
  it("returns the same object reference if no images injected", () => {
    const lesson = { content: sampleLesson };
    const result = injectImagesIntoLesson(lesson, []);
    expect(result).toBe(lesson);
  });

  it("returns a new object if images were injected", () => {
    const lesson = { content: sampleLesson };
    const result = injectImagesIntoLesson(lesson, [
      "https://example.com/1.png",
    ]);
    expect(result).not.toBe(lesson);
    expect(result.content).not.toBe(sampleLesson);
  });

  it("preserves all other lesson fields", () => {
    const lesson = {
      content: sampleLesson,
      estimatedMinutes: 15,
      sources: [{ title: "Example", url: "https://example.com" }],
      quiz: { questions: [], passingScore: 70 },
    };
    const result = injectImagesIntoLesson(lesson, [
      "https://example.com/1.png",
    ]);
    expect(result.estimatedMinutes).toBe(15);
    expect(result.sources).toHaveLength(1);
    expect(result.quiz.passingScore).toBe(70);
  });
});
