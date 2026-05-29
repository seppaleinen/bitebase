export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ExtractedProfile {
  topic: string;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  goals: string;
  availableMinutesPerDay: number;
}

/**
 * Attempt to build a complete profile object from the conversation history.
 * Returns null if any required field is missing or invalid.
 */
export function extractProfileValues(messages: ChatMessage[]): ExtractedProfile | null {
  const userMessages = messages.filter((m) => m.role === "user").map((m) => m.content);
  const assistantText = messages
    .filter((m) => m.role === "assistant")
    .map((m) => m.content)
    .join("\n")
    .toLowerCase();

  // topic
  const topicMatch = assistantText.match(
    /learn(?:ing)?\s+([\w\s]+?)(?:\s+as\s+a|\s+from|\s+for|[,!.])/
  );
  const topic = topicMatch?.[1]?.trim() ?? "";

  // experienceLevel — last occurrence wins
  let experienceLevel: ExtractedProfile["experienceLevel"] | null = null;
  for (const msg of userMessages) {
    const m = msg.toLowerCase().match(/\b(beginner|intermediate|advanced)\b/);
    if (m) experienceLevel = m[1] as ExtractedProfile["experienceLevel"];
  }

  // goals — last qualifying user message wins
  let goals: string | null = null;
  for (const msg of userMessages) {
    const c = msg.trim();
    if (
      c.split(/\s+/).length >= 2 &&
      !/^\s*\d+\s*(minutes?|mins?|hours?|hrs?)\s*$/i.test(c) &&
      !/^\s*(beginner|intermediate|advanced)\s*$/i.test(c)
    ) {
      goals = c;
    }
  }

  // availableMinutesPerDay — last numeric time mention wins
  let availableMinutesPerDay: number | null = null;
  for (const msg of userMessages) {
    const m = msg.toLowerCase().match(/(\d+)\s*(?:minutes?|mins?|hours?|hrs?)/);
    if (m) {
      const raw = parseInt(m[1], 10);
      availableMinutesPerDay = /hours?|hrs?/.test(msg.toLowerCase()) ? raw * 60 : raw;
    }
  }

  if (
    topic &&
    experienceLevel &&
    goals &&
    availableMinutesPerDay !== null &&
    availableMinutesPerDay >= 5
  ) {
    return { topic, experienceLevel, goals, availableMinutesPerDay };
  }
  return null;
}

/**
 * Scan conversation history and extract whichever of the 4 profile fields have
 * already been mentioned by the user (simple heuristics, not LLM). Injecting
 * this summary into every system prompt prevents the model from re-asking for
 * values it visibly received earlier in the thread.
 */
export function extractCollectedFields(messages: ChatMessage[]): string {
  const userMessages = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content);

  const assistantText = messages
    .filter((m) => m.role === "assistant")
    .map((m) => m.content)
    .join("\n")
    .toLowerCase();

  const collected: string[] = [];
  const missing: string[] = [];

  // For every field we scan messages in chronological order and take the LAST
  // match so that a correction ("actually 15 minutes") overrides the earlier value.

  // topic — present if the assistant acknowledged a topic
  const topicMatch = assistantText.match(/learn(?:ing)?\s+([\w\s]+?)(?:\s+as\s+a|\s+from|\s+for|[,!.])/);
  if (topicMatch) {
    collected.push(`topic="${topicMatch[1].trim()}"`);
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

  // goals — last user message that isn't purely a level or time answer
  let goals: string | null = null;
  for (const msg of userMessages) {
    const c = msg.trim();
    if (
      c.split(/\s+/).length >= 2 &&
      !/^\s*\d+\s*(minutes?|mins?|hours?|hrs?)\s*$/i.test(c) &&
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

  // availableMinutesPerDay — last numeric time mention wins
  let availableMinutesPerDay: number | null = null;
  for (const msg of userMessages) {
    const m = msg.toLowerCase().match(/(\d+)\s*(?:minutes?|mins?|hours?|hrs?)/);
    if (m) {
      const raw = parseInt(m[1], 10);
      availableMinutesPerDay = /hours?|hrs?/.test(msg.toLowerCase()) ? raw * 60 : raw;
    }
  }
  if (availableMinutesPerDay !== null) {
    collected.push(`availableMinutesPerDay=${availableMinutesPerDay}`);
  } else {
    missing.push("availableMinutesPerDay");
  }

  const parts: string[] = [];
  if (collected.length > 0) parts.push(`Already collected: ${collected.join(", ")}.`);
  if (missing.length > 0) parts.push(`Still need: ${missing.join(", ")}.`);
  if (missing.length === 0) parts.push("You have all 4 values — emit the PROFILE line now.");
  return parts.join(" ");
}
