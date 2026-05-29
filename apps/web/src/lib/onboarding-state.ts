import type { ChatMessage, ExtractedProfile } from "@bitebase/ai";
import { extractProfileValues, extractTopic } from "@bitebase/ai";

export type { ChatMessage, ExtractedProfile };
export { extractProfileValues, extractTopic };

/**
 * Scan conversation history and extract whichever of the 3 profile fields have
 * already been mentioned by the user (simple heuristics, not LLM). Injecting
 * this summary into every system prompt prevents the model from re-asking for
 * values it visibly received earlier in the thread.
 */
export function extractCollectedFields(messages: ChatMessage[]): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);

  const collected: string[] = [];
  const missing: string[] = [];

  // For every field we scan messages in chronological order and take the LAST
  // match so that a correction overrides the earlier value.

  // topic — extract from user messages only (prevents false matches on "learning assistant")
  const topic = extractTopic(userMessages);
  if (topic) {
    collected.push(`topic="${topic}"`);
  } else {
    missing.push("topic");
  }

  // experienceLevel — last occurrence across user messages wins
  let experienceLevel: string | null = null;
  for (const msg of userMessages) {
    const m = msg.toLowerCase().match(/\b(beginner|intermediate|advanced)\b/);
    if (m) experienceLevel = m[1];
  }
  if (experienceLevel) {
    collected.push(`experienceLevel="${experienceLevel}"`);
  } else {
    missing.push("experienceLevel (beginner/intermediate/advanced)");
  }

  // goals — last user message that isn't purely a level answer and wasn't
  // already consumed as the topic (avoids double-counting the first message).
  let goals: string | null = null;
  for (const msg of userMessages) {
    const c = msg.trim();
    if (
      c.split(/\s+/).length >= 2 &&
      !/^\s*(beginner|intermediate|advanced)\s*$/i.test(c) &&
      !/(?:learn|study|teach(?:\s+me)?(?:\s+about)?|interested\s+in)\s+/i.test(c)
    ) {
      goals = c;
    }
  }
  if (goals) {
    collected.push(`goals="${goals}"`);
  } else {
    missing.push("goals");
  }

  const parts: string[] = [];
  if (collected.length > 0) parts.push(`Already collected: ${collected.join(", ")}.`);
  if (missing.length > 0) parts.push(`Still need: ${missing.join(", ")}.`);
  if (missing.length === 0) parts.push("You have all 3 values — emit the PROFILE line now.");
  return parts.join(" ");
}
