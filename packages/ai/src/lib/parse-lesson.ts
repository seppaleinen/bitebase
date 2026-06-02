type QuizQuestion = {
  id: string;
  type: "multiple_choice" | "fill_in_blank";
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
};

/** Fix unescaped control characters (newlines, tabs) inside JSON string values. */
function fixJsonControlChars(text: string): string {
  let inString = false;
  let escaped = false;
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (escaped) { result += char; escaped = false; continue; }
    if (char === "\\" && inString) { result += char; escaped = true; continue; }
    if (char === '"') { inString = !inString; result += char; continue; }
    if (inString) {
      if (char === "\n") { result += "\\n"; continue; }
      if (char === "\r") { result += "\\r"; continue; }
      if (char === "\t") { result += "\\t"; continue; }
    }
    result += char;
  }
  return result;
}

/**
 * Attempt to repair common JSON issues from local LLM output.
 * Tries increasingly aggressive strategies:
 *   1. Fix trailing commas before ] and }
 *   2. Complete truncated JSON by balancing braces/brackets
 *   3. Strip trailing text after the JSON document ends
 */
function repairJson(raw: string): string {
  // Step 1: remove trailing commas inside arrays/objects
  let cleaned = raw.replace(/,\s*([}\]])/g, "$1");

  // Step 2: try parsing after basic cleanup
  try { JSON.parse(cleaned); return cleaned; } catch { /* continue */ }

  // Step 3: count braces and try appending missing closing brackets
  // Balance the nesting by counting { and } and [ and ]
  let openBraces = 0;
  let openBrackets = 0;
  const chars = [...cleaned];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === "{") openBraces++;
    else if (c === "}") openBraces--;
    else if (c === "[") openBrackets++;
    else if (c === "]") openBrackets--;
  }
  if (openBraces > 0 || openBrackets > 0) {
    // Append whatever closing brackets are needed
    let completed = cleaned;
    while (openBraces > 0) { completed += "}"; openBraces--; }
    while (openBrackets > 0) { completed += "]"; openBrackets--; }
    try { JSON.parse(completed); return completed; } catch { /* continue */ }
  }

  // Step 4: strip trailing text after the outermost } or ]
  // by finding the last complete object boundary
  let depth = 0;
  let firstFullClose = -1;
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) {
        firstFullClose = i;
        break;
      }
    }
  }
  if (firstFullClose > 0) {
    const trimmed = cleaned.slice(0, firstFullClose + 1);
    try { JSON.parse(trimmed); return trimmed; } catch { /* not valid */ }
  }

  return cleaned;
}

/**
 * Normalize model output: replace decorated or emoji-prefixed separator lines
 * with the standard ===LABEL=== format that the section parser expects.
 *
 * Handles two patterns:
 *   1. First non-standard section (e.g. "=== 🎯 Title ===") → "===CONTENT==="
 *   2. Decorated standard labels (e.g. "=== ⏰ MINUTES ===") → "===MINUTES==="
 */
function normalizeSeparators(text: string): string {
  const standardLabels = new Set(["CONTENT", "MINUTES", "SOURCES", "QUIZ", "VOCABULARY"]);

  // Phase 1: fix decorated standard separators (emoji or text between === and label)
  for (const label of standardLabels) {
    const decorated = new RegExp(`^===\\s*[^=]*?${label}[^=]*?===\\s*$`, "gim");
    text = text.replace(decorated, `===${label}===`);
  }

  // Phase 2: if the first ===...=== block is not a standard label, it's likely
  // the model using "=== Title ===" as a heading instead of ===CONTENT===.
  const sectionRe = /^(===)\s*([^=]+?)\s*(===)\s*$/m;
  const first = text.match(sectionRe);
  if (first && !standardLabels.has(first[2].trim().toUpperCase())) {
    text = text.slice(0, first.index!) + "===CONTENT===" + text.slice(first.index! + first[0].length);
  }

  return text;
}

/**
 * Parse a lesson response in separator format into structured data.
 *
 * The model writes delimited sections:
 *   ===CONTENT=== — markdown lesson body
 *   ===MINUTES=== — estimated reading time (integer)
 *   ===SOURCES=== — JSON array of { title, url }
 *   ===QUIZ===    — JSON object with { questions, passingScore }
 *   ===VOCABULARY=== — JSON array of vocab items (language courses only, optional)
 *
 * Throws if the CONTENT section is missing; quiz/sources/vocabulary parse failures are
 * swallowed and return safe defaults so a partial lesson is still saved.
 */
export interface LessonSection {
  title: string;
  markdown: string;
  image?: string;
}

export type VocabItem = {
  word: string;
  language: string;
  pronunciation: string;
  definition: string;
};

export function parseLessonResponse(text: string): {
  content: string;
  estimatedMinutes: number;
  sources: { title: string; url: string; imageUrls?: string[] }[];
  quiz: { questions: QuizQuestion[]; passingScore: number };
  sections: LessonSection[];
  vocabulary: VocabItem[];
} {
  const normalized = normalizeSeparators(text);

  const section = (name: string) => {
    const re = new RegExp(`===\\s*${name}\\s*===\\s*([\\s\\S]*?)(?====|$)`, "i");
    return normalized.match(re)?.[1]?.trim() ?? "";
  };

  const content = section("CONTENT");
  const minutesRaw = section("MINUTES");
  const sourcesRaw = section("SOURCES");
  const quizRaw = section("QUIZ");
  const vocabRaw = section("VOCABULARY");

  const estimatedMinutes = Math.max(1, parseInt(minutesRaw) || 10);

  let sources: { title: string; url: string; imageUrls?: string[] }[] = [];
  try {
    const parsed = JSON.parse(sourcesRaw || "[]");
    if (Array.isArray(parsed)) sources = parsed;
  } catch {
    // ignore malformed sources
  }

  let quiz: { questions: QuizQuestion[]; passingScore: number } = { questions: [], passingScore: 70 };
  try {
    const quizJson = quizRaw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "");
    const fixedCtrls = fixJsonControlChars(quizJson);
    const repaired = repairJson(fixedCtrls);
    const parsed = JSON.parse(repaired);
    if (parsed?.questions) {
      quiz = {
        questions: parsed.questions as QuizQuestion[],
        passingScore: parseInt(parsed.passingScore) || 70,
      };
    }
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[parse-lesson] quiz parse failed — saving lesson without questions:", err instanceof Error ? err.message : err);
      console.warn("[parse-lesson] raw quiz text:", quizRaw.slice(0, 500));
    }
  }

  // Parse vocabulary section (language courses)
  let vocabulary: VocabItem[] = [];
  if (vocabRaw) {
    try {
      const parsed = JSON.parse(vocabRaw);
      if (Array.isArray(parsed)) {
        vocabulary = parsed.filter(
          (v: unknown): v is VocabItem =>
            typeof v === "object" && v !== null &&
            typeof (v as VocabItem).word === "string" &&
            typeof (v as VocabItem).language === "string" &&
            typeof (v as VocabItem).pronunciation === "string"
        );
      }
    } catch {
      // Ignore malformed vocabulary — non-language lessons omit it entirely
    }
  }

  // Parse sections within the content
  function parseSections(raw: string): LessonSection[] {
    const sections: LessonSection[] = [];
    const sectionRe = /===SECTION===\s*([\s\S]*?)===ENDSECTION===/gi;
    let match: RegExpExecArray | null;
    while ((match = sectionRe.exec(raw)) !== null) {
      const block = match[1].trim();
      // Extract title (first markdown heading)
      const titleMatch = block.match(/^#\s+(.*)$/m);
      const title = titleMatch ? titleMatch[1].trim() : "Untitled Section";
      // Extract optional image URL
      const imageMatch = block.match(/===IMAGE===\s*([\s\S]*?)\s*(?===|$)/i);
      const image = imageMatch ? imageMatch[1].trim() : undefined;
      // Remove the image block from markdown
      const markdown = block.replace(/===IMAGE===\s*[\s\S]*$/i, "").trim();
      sections.push({ title, markdown, image });
    }
    // Fallback: if no sections found, treat whole content as one section
    if (sections.length === 0) {
      const titleMatch = raw.match(/^#\s+(.*)$/m);
      const title = titleMatch ? titleMatch[1].trim() : "Lesson";
      sections.push({ title, markdown: raw.trim() });
    }
    return sections;
  }

  if (!content) throw new Error("No ===CONTENT=== section found in lesson response");

  const sections = parseSections(content);

  return { content, estimatedMinutes, sources, quiz, sections, vocabulary };
}
