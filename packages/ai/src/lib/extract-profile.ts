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
export function extractTopic(userMessages: string[]): string {
  for (const msg of userMessages) {
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

  let experienceLevel: ExtractedProfile["experienceLevel"] | null = null;
  for (const msg of userMessages) {
    const m = msg.toLowerCase().match(/\b(beginner|intermediate|advanced)\b/);
    if (m) experienceLevel = m[1] as ExtractedProfile["experienceLevel"];
  }

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

  if (topic && experienceLevel && goals) {
    return { topic, experienceLevel, goals };
  }
  return null;
}
