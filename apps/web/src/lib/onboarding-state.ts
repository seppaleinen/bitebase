export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ExtractedProfile {
  topic: string;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  goals: string;
}

/** Extract the topic from user messages only (never from assistant text). */
function extractTopic(userMessages: string[]): string {
  for (const msg of userMessages) {
    // "learn X", "study X", "teach me X", "teach me about X", "interested in X"
    const m = msg.match(
      /(?:learn|study|teach(?:\s+me)?(?:\s+about)?|interested\s+in)\s+(?:about\s+)?([a-z][\w\s]{1,50}?)(?:\s+as\s+a|\s+as\s+an|\s+at\s+|\s+from\s+|\s+for\s+|\s+level|[,!.?]|-|$)/i
    );
    if (m?.[1]) {
      const t = m[1].trim().replace(/\s+/g, " ").toLowerCase();
      if (t.length >= 2 && !["me", "it", "more", "this", "that"].includes(t)) {
        return t;
      }
    }
  }
  // Fallback: if the first user message is short, treat it as the topic
  if (userMessages.length > 0) {
    const first = userMessages[0].replace(/^[-*•]\s*/, "").trim().toLowerCase();
    if (first.split(/\s+/).length <= 5) return first;
  }
  return "";
}

/**
 * Attempt to build a complete profile object from the conversation history.
 * Returns null if any required field is missing or invalid.
 */
export function extractProfileValues(messages: ChatMessage[]): ExtractedProfile | null {
  const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content);

  const topic = extractTopic(userMessages);

  // experienceLevel — last occurrence in user messages wins
  let experienceLevel: ExtractedProfile["experienceLevel"] | null = null;
  for (const msg of userMessages) {
    const m = msg.toLowerCase().match(/\b(beginner|intermediate|advanced)\b/);
    if (m) experienceLevel = m[1] as ExtractedProfile["experienceLevel"];
  }

  // goals — last qualifying user message (≥2 words, not just a level word) wins
  let goals: string | null = null;
  for (const msg of userMessages) {
    const c = msg.trim();
    if (
      c.split(/\s+/).length >= 2 &&
      !/^\s*(beginner|intermediate|advanced)\s*$/i.test(c)
    ) {
      goals = c;
    }
  }

  if (topic && experienceLevel && goals) {
    return { topic, experienceLevel, goals };
  }
  return null;
}

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

  // goals — last user message that isn't purely a level answer
  let goals: string | null = null;
  for (const msg of userMessages) {
    const c = msg.trim();
    if (
      c.split(/\s+/).length >= 2 &&
      !/^\s*(beginner|intermediate|advanced)\s*$/i.test(c)
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
