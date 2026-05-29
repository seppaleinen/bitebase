import { describe, it, expect } from "vitest";
import { getSuggestions } from "../src/lib/onboarding-suggestions";

function msg(overrides: Partial<{ id: string; content: string; role: string }> = {}) {
  return {
    id: overrides.id ?? "1",
    role: overrides.role ?? "user",
    content: overrides.content ?? "",
  };
}

describe("getSuggestions", () => {
  it("returns beginner/intermediate/advanced when AI asks about experience level", () => {
    const messages = [msg({ content: "I want to learn French" }), msg({
      id: "welcome",
      role: "assistant",
      content: "What's your experience level with French? Beginner, Intermediate, or Advanced?",
    })];
    expect(getSuggestions(messages, false, null)).toEqual(["Beginner", "Intermediate", "Advanced"]);
  });

  it("returns level chips when AI asks 'how advanced are you'", () => {
    const messages = [msg({ content: "quantum physics" }), msg({
      id: "a1",
      role: "assistant",
      content: "How advanced is your understanding of quantum physics?",
    })];
    expect(getSuggestions(messages, false, null)).toEqual(["Beginner", "Intermediate", "Advanced"]);
  });

  it("returns empty when user already answered level and AI asks about it again", () => {
    const messages = [msg({ content: "I want to learn Spanish" }), msg({
      id: "a1",
      role: "assistant",
      content: "What level are you?",
    }), msg({ content: "Beginner" }), msg({
      id: "a2",
      role: "assistant",
      content: "What's your experience level with Spanish?",
    })];
    expect(getSuggestions(messages, false, null)).toEqual([]);
  });

  it("returns 'or' chips when AI presents options separated by 'or'", () => {
    const messages = [msg({ content: "Italian" }), msg({
      content: "Beginner",
      id: "u1",
    }), msg({
      id: "a1",
      role: "assistant",
      content: "Do you want to learn conversational Italian or focus more on grammar?",
    })];
    const suggestions = getSuggestions(messages, false, null);
    expect(suggestions).toContain("Do you want to");
    expect(suggestions).toContain("Focus more on grammar");
  });

  it("includes 'No preference' when 'or' extraction yields multiple options", () => {
    const messages = [msg({ content: "cooking" }), msg({
      id: "u1",
      content: "Advanced",
    }), msg({
      id: "a1",
      role: "assistant",
      content: "Would you like to focus on baking or grilling?",
    })];
    const suggestions = getSuggestions(messages, false, null);
    expect(suggestions).toContain("To focus on baking");
    expect(suggestions).toContain("Grilling");
    expect(suggestions).toContain("No preference");
  });

  it("returns empty when no 'or' pattern is found in AI question", () => {
    const messages = [msg({ content: "Python" }), msg({
      id: "u1",
      content: "Intermediate",
    }), msg({
      id: "a1",
      role: "assistant",
      content: "What specific area of Python are you interested in?",
    })];
    expect(getSuggestions(messages, false, null)).toEqual([]);
  });

  it("returns empty when finalizedProfile is set", () => {
    const messages = [msg({ content: "history" }), msg({
      id: "a1",
      role: "assistant",
      content: "What level?",
    })];
    expect(getSuggestions(messages, false, { topic: "history", experienceLevel: "Intermediate", goals: "Learn" })).toEqual([]);
  });

  it("returns empty when isLoading is true", () => {
    expect(getSuggestions([], true, null)).toEqual([]);
  });

  it("returns empty when no assistant messages exist", () => {
    expect(getSuggestions([msg({ content: "hi" })], false, null)).toEqual([]);
  });
});
