/**
 * Pure unit tests for the SUGGESTIONS/PROFILE marker-stripping regexes used on
 * the onboarding page to clean AI response text before display.
 *
 * The regexes live in the onboarding page component; they are replicated here
 * as pure functions so the tests need no React or DOM environment.
 */
import { describe, it, expect } from "vitest";

// Replicated from apps/web/src/app/(app)/onboarding/page.tsx
function stripMarkers(text: string): string {
  return text
    .replace(/SUGGESTIONS:\s*\[[^\]]*\]/g, "")
    .replace(/PROFILE:\s*\{[^}]*\}/g, "");
}

// ─── SUGGESTIONS stripping ────────────────────────────────────────────────────

describe("SUGGESTIONS marker stripping", () => {
  it("removes a SUGGESTIONS block from display text", () => {
    const input = 'Great question! SUGGESTIONS: ["Option A", "Option B"] What do you prefer?';
    expect(stripMarkers(input)).not.toContain("SUGGESTIONS:");
    expect(stripMarkers(input)).not.toContain("Option A");
  });

  it("leaves non-marker text intact after stripping SUGGESTIONS", () => {
    const input = "Hello! SUGGESTIONS: [\"Yes\", \"No\"] How are you?";
    const result = stripMarkers(input);
    expect(result).toContain("Hello!");
    expect(result).toContain("How are you?");
  });

  it("handles SUGGESTIONS with extra whitespace after the colon", () => {
    const input = "SUGGESTIONS:    [\"A\", \"B\"]";
    expect(stripMarkers(input)).not.toContain("SUGGESTIONS:");
  });

  it("removes an empty SUGGESTIONS block", () => {
    const input = "Pick one: SUGGESTIONS: []";
    expect(stripMarkers(input)).not.toContain("SUGGESTIONS:");
  });
});

// ─── PROFILE stripping ────────────────────────────────────────────────────────

describe("PROFILE marker stripping", () => {
  it("removes a PROFILE block from display text", () => {
    const input = 'Understood! PROFILE: {"topic": "Go", "level": "beginner"} Let\'s continue.';
    const result = stripMarkers(input);
    expect(result).not.toContain("PROFILE:");
    expect(result).not.toContain('"topic"');
  });

  it("leaves non-marker text intact after stripping PROFILE", () => {
    const input = 'Understood! PROFILE: {"topic": "Go"} Let\'s continue.';
    const result = stripMarkers(input);
    expect(result).toContain("Understood!");
    expect(result).toContain("Let's continue.");
  });

  it("handles PROFILE with extra whitespace after the colon", () => {
    const input = 'PROFILE:   {"topic": "Python"}';
    expect(stripMarkers(input)).not.toContain("PROFILE:");
  });

  it("removes an empty PROFILE block", () => {
    const input = "Done. PROFILE: {}";
    expect(stripMarkers(input)).not.toContain("PROFILE:");
  });
});

// ─── Both markers together ────────────────────────────────────────────────────

describe("stripping both SUGGESTIONS and PROFILE markers", () => {
  it("removes both markers when they appear together in the same string", () => {
    const input = 'Nice! SUGGESTIONS: ["Yes", "No"] PROFILE: {"topic": "Rust"} Ready?';
    const result = stripMarkers(input);
    expect(result).not.toContain("SUGGESTIONS:");
    expect(result).not.toContain("PROFILE:");
    expect(result).toContain("Nice!");
    expect(result).toContain("Ready?");
  });

  it("removes both when SUGGESTIONS appears before PROFILE", () => {
    const input = 'SUGGESTIONS: ["A"] Some text. PROFILE: {"x": "y"}';
    const result = stripMarkers(input);
    expect(result).not.toContain("SUGGESTIONS:");
    expect(result).not.toContain("PROFILE:");
    expect(result).toContain("Some text.");
  });

  it("removes both when PROFILE appears before SUGGESTIONS", () => {
    const input = 'PROFILE: {"x": "y"} Some text. SUGGESTIONS: ["A"]';
    const result = stripMarkers(input);
    expect(result).not.toContain("PROFILE:");
    expect(result).not.toContain("SUGGESTIONS:");
    expect(result).toContain("Some text.");
  });
});

// ─── No markers present ───────────────────────────────────────────────────────

describe("text without markers", () => {
  it("returns the original text unchanged when no markers are present", () => {
    const input = "Hello! How can I help you learn today?";
    expect(stripMarkers(input)).toBe(input);
  });

  it("does not modify text that contains the word SUGGESTIONS but not in marker format", () => {
    const input = "I have some suggestions for you.";
    expect(stripMarkers(input)).toBe(input);
  });

  it("does not modify text that contains the word PROFILE but not in marker format", () => {
    const input = "Your profile has been saved.";
    expect(stripMarkers(input)).toBe(input);
  });
});
