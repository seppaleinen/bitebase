import { describe, it, expect } from "vitest";
import { extractSummary, summaryBody } from "./extract-summary";

describe("extractSummary", () => {
  it("returns null for empty content", () => {
    expect(extractSummary("")).toBeNull();
    expect(extractSummary(null as unknown as string)).toBeNull();
  });

  it("returns null when no summary heading exists", () => {
    const md = "# My Lesson\n\nSome content here.\n\n## Another Section\nMore content.\n";
    expect(extractSummary(md)).toBeNull();
  });

  it("extracts section under ## Conclusion", () => {
    const md = [
      "# My Lesson",
      "",
      "## Introduction",
      "Content.",
      "",
      "## Conclusion",
      "Key point one.",
      "",
      "Key point two.",
      "",
      "## Next Section",
      "Other content.",
    ].join("\n");

    const result = extractSummary(md);
    expect(result).not.toBeNull();
    expect(result!.heading).toContain("Conclusion");
    expect(result!.section).toContain("Key point one");
    expect(result!.section).toContain("Key point two");
    expect(result!.rest).toContain("Next Section");
    expect(result!.startLine).toBe(5); // 0-indexed line of "## Conclusion"
    expect(result!.endLine).toBe(10); // line of "## Next Section"
  });

  it("finds the LAST matching heading", () => {
    const md = [
      "# My Lesson",
      "",
      "## Summary",
      "First summary.",
      "",
      "## Conclusion",
      "Second summary.",
    ].join("\n");

    const result = extractSummary(md);
    expect(result).not.toBeNull();
    expect(result!.heading).toBe("Conclusion");
    expect(result!.section).toContain("Second summary");
  });

  it("extracts ### Summary as subsection", () => {
    const md = [
      "# My Lesson",
      "",
      "## Main Section",
      "Content.",
      "",
      "### Summary",
      "Key insight.",
      "",
      "### Next Subsection",
      "Follow-up.",
      "",
      "## Another Section",
      "More content.",
    ].join("\n");

    const result = extractSummary(md);
    expect(result).not.toBeNull();
    expect(result!.section).toContain("Key insight.");
    // Should stop at next ### or ##
    expect(result!.section).not.toContain("Follow-up");
  });

  it("extracts content to end when summary is the last thing", () => {
    const md = [
      "# My Lesson",
      "",
      "## Body",
      "Stuff.",
      "",
      "## Key Takeaways",
      "Takeaway 1.",
      "",
      "Takeaway 2.",
    ].join("\n");

    const result = extractSummary(md);
    expect(result).not.toBeNull();
    expect(result!.section).toContain("Takeaway 1");
    expect(result!.section).toContain("Takeaway 2");
    expect(result!.rest).toBe("");
  });

  it("matches various keyword forms", () => {
    const testCases = [
      { keyword: "## Recap", expect: true },
      { keyword: "## Wrap Up", expect: true },
      { keyword: "## wrap-up", expect: true },
      { keyword: "## Key Points", expect: true },
      { keyword: "## Next Steps", expect: true },
      { keyword: "## unrelated", expect: false },
    ];

    for (const { keyword, expect: shouldMatch } of testCases) {
      const md = ["# Lesson", "", keyword, "", "Content.", ""].join("\n");
      expect(extractSummary(md) !== null).toBe(shouldMatch);
    }
  });

  it("handles emoji-prefixed headings", () => {
    const md = [
      "# Lesson",
      "",
      "## 📝 Summary",
      "Content here.",
    ].join("\n");
    const result = extractSummary(md);
    expect(result).not.toBeNull();
    expect(result!.heading).toBe("📝 Summary");
  });

  it("handles headings with mixed case", () => {
    const md = [
      "# Lesson",
      "",
      "## KEY TAKEAWAYS",
      "Important stuff.",
    ].join("\n");
    const result = extractSummary(md);
    expect(result).not.toBeNull();
    expect(result!.section).toContain("Important stuff");
  });

  it("does not crash on markdown with no headings at all", () => {
    expect(extractSummary("Just a plain paragraph.")).toBeNull();
  });
});

describe("summaryBody", () => {
  it("strips the heading line", () => {
    const section = "## Conclusion\n\nKey point.\n\nAnother point.\n";
    expect(summaryBody(section)).not.toContain("## Conclusion");
    expect(summaryBody(section)).toContain("Key point.");
    expect(summaryBody(section)).toContain("Another point.");
  });

  it("strips sub-headings inside the summary", () => {
    const section = "## Conclusion\n\nKey point.\n\n### Sub-heading\nDetail.\n";
    const body = summaryBody(section);
    expect(body).not.toContain("### Sub-heading");
    expect(body).toContain("Detail.");
  });

  it("returns empty string for heading-only section", () => {
    expect(summaryBody("## Conclusion\n")).toBe("");
  });
});
