import { describe, it, expect } from "vitest";
import { extractCollectedFields, type ChatMessage } from "./onboarding-state";

describe("extractCollectedFields", () => {
  it("returns all 3 fields as missing when messages are empty", () => {
    const result = extractCollectedFields([]);
    expect(result).not.toContain("Already collected:");
    expect(result).toContain("Still need:");
    expect(result).toContain("topic");
    expect(result).toContain("experienceLevel");
    expect(result).toContain("goals");
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

  it("collects goals from a long user sentence without level keywords", () => {
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

  it("reports 'You have all 3 values' when all fields are present", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Beginner" },
      {
        role: "user",
        content: "I want to become fluent in French for work",
      },
      {
        role: "assistant",
        content:
          "Great! I will help you with learning French as a beginner.",
      },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain("You have all 3 values — emit the PROFILE line now.");
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

  // ── Topic/goals overlap prevention ────────────────────────────────────────

  it("does not extract goals from a topic statement like 'I want to learn Italian'", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I want to learn Italian" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain('topic="italian"');
    expect(result).not.toContain("goals=");
  });

  it("does not extract goals from 'study X' messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I'd like to study quantum physics" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain('topic="quantum physics"');
    expect(result).not.toContain("goals=");
  });

  it("does not extract goals from 'teach me about X' messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "Teach me about machine learning" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain('topic="machine learning"');
    expect(result).not.toContain("goals=");
  });

  it("does not extract goals from 'interested in X' messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I'm interested in woodworking" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain('topic="woodworking"');
    expect(result).not.toContain("goals=");
  });

  it("extracts topic from first message and goals from a later message separately", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "I want to learn Italian" },
      {
        role: "assistant",
        content: "Great choice! What's your experience level?",
      },
      { role: "user", content: "Beginner" },
      {
        role: "assistant",
        content: "Got it. What are your goals for learning Italian?",
      },
      {
        role: "user",
        content: "I want to have conversations with my in-laws",
      },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain('topic="italian"');
    expect(result).toContain('experienceLevel="beginner"');
    expect(result).toContain("goals=");
    expect(result).toContain("I want to have conversations with my in-laws");
    expect(result).toContain("You have all 3 values");
  });

  it("still extracts goals from non-topic multi-word messages", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "hold conversations" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain("goals=");
    expect(result).toContain("hold conversations");
  });

  it("treats 'I want to learn X' as topic only, not goals, even with 2+ words", () => {
    const messages: ChatMessage[] = [
      { role: "user", content: "learn Spanish" },
    ];
    const result = extractCollectedFields(messages);
    expect(result).toContain('topic="spanish"');
    expect(result).not.toContain("goals=");
  });
});
