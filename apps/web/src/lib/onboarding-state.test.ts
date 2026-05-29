import { describe, it, expect } from "vitest";
import { extractCollectedFields, type ChatMessage } from "./onboarding-state";

describe("extractCollectedFields", () => {
  it("returns all 4 fields as missing when messages are empty", () => {
    const result = extractCollectedFields([]);
    expect(result).not.toContain("Already collected:");
    expect(result).toContain("Still need:");
    expect(result).toContain("topic");
    expect(result).toContain("experienceLevel");
    expect(result).toContain("goals");
    expect(result).toContain("availableMinutesPerDay");
  });

  it("collects topic and experienceLevel from a user+assistant exchange", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I want to learn French as a beginner" },
      {
        role: "assistant",
        content:
          "Great! I will help you with learning French as a beginner. What are your goals?",
      },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain('topic="french"');
    expect(result).toContain('experienceLevel="beginner"');
  });

  it("collects availableMinutesPerDay=30 when user says '30 minutes'", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "30 minutes" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain("availableMinutesPerDay=30");
  });

  it("collects availableMinutesPerDay=60 when user says '1 hour'", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I can dedicate 1 hour each day" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain("availableMinutesPerDay=60");
  });

  it("collects goals from a long user sentence without level or minutes keywords", () => {
    const messages: ChatMessage[] = [
      {
        role: "user",
        content: "I want to become fluent in French for work",
      },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain("goals=");
    expect(result).toContain("I want to become fluent in French for work");
  });

  it("collects goals from a short two-word answer like 'hold conversations'", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hold conversations" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain("goals=");
    expect(result).toContain("hold conversations");
  });

  it("does not treat a standalone level word as a goal", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Beginner" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).not.toContain("goals=");
  });

  it("does not treat a standalone time answer as a goal", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "5 minutes" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).not.toContain("goals=");
  });

  it("reports 'You have all 4 values' when all fields are present", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Beginner" },
      {
        role: "user",
        content: "I want to become fluent in French for work",
      },
      { role: "user", content: "30 minutes" },
      {
        role: "assistant",
        content:
          "Great! I will help you with learning French as a beginner.",
      },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain("You have all 4 values — emit the PROFILE line now.");
    expect(result).not.toContain("Still need:");
  });

  it("does not double-count experienceLevel when 'Beginner' appears in two separate messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Beginner" },
      { role: "user", content: "Yes, I am a Beginner" },
    ];
    const result = extractCollectedFields(messages);
    const occurrences = (result.match(/experienceLevel/g) ?? []).length;
    expect(occurrences).toBe(1);
  });

  // ── Correction / "last value wins" behaviour ──────────────────────────────

  it("uses the LAST minutes value when the user corrects from 5 to 15 minutes", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "5 minutes" },
      { role: "assistant", content: "Got it, 5 minutes a day." },
      { role: "user", content: "actually 15 minutes" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain("availableMinutesPerDay=15");
    expect(result).not.toContain("availableMinutesPerDay=5");
  });

  it("uses the LAST experience level when the user corrects from beginner to intermediate", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Beginner" },
      { role: "assistant", content: "Great, noted as beginner." },
      { role: "user", content: "Actually I think I am intermediate" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain('experienceLevel="intermediate"');
    expect(result).not.toContain('experienceLevel="beginner"');
  });

  it("uses the LAST goals sentence when the user refines their goal", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "learn some basics" },
      { role: "assistant", content: "Sounds good." },
      { role: "user", content: "hold confident conversations in French" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain("hold confident conversations in French");
    expect(result).not.toContain("learn some basics");
  });

  it("converts '1 hour' to 60 minutes and later '2 hours' to 120 minutes (last wins)", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "1 hour" },
      { role: "user", content: "actually 2 hours" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain("availableMinutesPerDay=120");
    expect(result).not.toContain("availableMinutesPerDay=60");
  });
});
