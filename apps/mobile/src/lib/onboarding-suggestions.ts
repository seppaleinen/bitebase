type Message = { id: string; content: string; role: string };

function extractOrOptions(text: string): string[] {
  if (!text.includes("?")) return [];

  const orParts = text.split(/\bor\b/i);
  if (orParts.length < 2 || orParts.length > 5) return [];

  const extracted = orParts.map((part) => {
    const segments = part.split(",").map((s) => s.trim()).filter(Boolean);
    const candidate = segments[segments.length - 1] ?? part.trim();
    const cleaned = candidate
      .replace(/^[\s?!.]+|[\s?!.]+$/g, "")
      .replace(
        /^(do you have a preference for|is your focus more on|are you (?:more )?interested in|would you (?:prefer|like)|do you prefer|a preference for)\s+/i,
        ""
      )
      .trim();
    const words = cleaned.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w)).slice(0, 4);
    if (words.length === 0) return "";
    const joined = words.join(" ");
    return joined.charAt(0).toUpperCase() + joined.slice(1);
  }).filter((o) => o.length >= 2 && o.length <= 40);

  const unique = [...new Set(extracted)].slice(0, 4);
  if (unique.length >= 2) return [...unique, "No preference"];
  return ["No preference"];
}

export function getSuggestions(
  messages: Message[],
  isLoading: boolean,
  finalizedProfile: unknown,
): string[] {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastAssistant || isLoading || finalizedProfile) return [];

  const allUserText = messages
    .filter((m) => m.role === "user")
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();
  const alreadyHasLevel = /\b(beginner|intermediate|advanced)\b/.test(allUserText);

  const aiText = lastAssistant.content.toLowerCase();
  const aiRaw = lastAssistant.content;

  if (
    !alreadyHasLevel &&
    (/experience|your level|what level|how (advanced|experienced)/.test(aiText) ||
      (aiRaw.includes("?") && /\b(beginner|intermediate|advanced)\b/.test(aiText)))
  )
    return ["Beginner", "Intermediate", "Advanced"];

  // Skip generic extraction for level questions when user already answered level.
  const isLevelQuestion = /experience|your level|what level|how (advanced|experienced)/.test(aiText) ||
    /\b(beginner|intermediate|advanced)\b/.test(aiText);
  if (alreadyHasLevel && isLevelQuestion) return [];

  return extractOrOptions(lastAssistant.content);
}
