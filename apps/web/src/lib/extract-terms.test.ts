import { describe, it, expect } from "vitest";
import { extractKeyTerms } from "./extract-terms";

describe("extractKeyTerms", () => {
  it("returns empty array for empty content", () => {
    expect(extractKeyTerms("")).toEqual([]);
    expect(extractKeyTerms(null as unknown as string)).toEqual([]);
  });

  it("extracts bolded terms", () => {
    const md = "**TypeScript** is a typed superset of **JavaScript**.";
    const terms = extractKeyTerms(md);
    expect(terms).toContain("TypeScript");
    expect(terms).toContain("JavaScript");
  });

  it("deduplicates case-insensitively", () => {
    const md = "**TypeScript** is great. **typescript** is cool.";
    const terms = extractKeyTerms(md);
    expect(terms).toHaveLength(1);
  });

  it("ignores terms inside code blocks", () => {
    const md = [
      "Use the **main** function.",
      "",
      "```ts",
      'const **notARealVar** = 42;',
      "```",
    ].join("\n");
    const terms = extractKeyTerms(md);
    expect(terms).toContain("main");
    expect(terms).not.toContain("notARealVar");
  });

  it("filters out common filler words", () => {
    const md = "**the** **and** **is** **TypeScript**.";
    const terms = extractKeyTerms(md);
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("and");
    expect(terms).not.toContain("is");
    expect(terms).toContain("TypeScript");
  });

  it("limits to 20 terms", () => {
    const md = Array.from({ length: 30 }, (_, i) => `**Term${i + 1}**`).join(" ");
    const terms = extractKeyTerms(md);
    expect(terms.length).toBeLessThanOrEqual(20);
  });

  it("sorts alphabetically", () => {
    const md = "**Zebra** is not **Apple**.";
    const terms = extractKeyTerms(md);
    expect(terms[0]).toBe("Apple");
    expect(terms[1]).toBe("Zebra");
  });

  it("returns empty for markdown with no bold text", () => {
    const md = "# Plain\n\nJust regular text.";
    expect(extractKeyTerms(md)).toEqual([]);
  });

  it("handles bold terms with punctuation", () => {
    const md = "**key_term** and **another-term**.";
    const terms = extractKeyTerms(md);
    expect(terms).toContain("key_term");
    expect(terms).toContain("another-term");
  });
});
