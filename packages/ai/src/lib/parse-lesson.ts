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
 * Normalize model output: replace decorated or emoji-prefixed separator lines
 * with the standard ===LABEL=== format that the section parser expects.
 *
 * Handles two patterns:
 *   1. First non-standard section (e.g. "=== 🎯 Title ===") → "===CONTENT==="
 *   2. Decorated standard labels (e.g. "=== ⏰ MINUTES ===") → "===MINUTES==="
 */
function normalizeSeparators(text: string): string {
  const standardLabels = new Set(["CONTENT", "MINUTES", "SOURCES", "QUIZ"]);

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
 * The model writes four delimited sections:
 *   ===CONTENT=== — markdown lesson body
 *   ===MINUTES=== — estimated reading time (integer)
 *   ===SOURCES=== — JSON array of { title, url }
 *   ===QUIZ===    — JSON object with { questions, passingScore }
 *
 * Throws if the CONTENT section is missing; quiz/sources parse failures are
 * swallowed and return safe defaults so a partial lesson is still saved.
 */
export interface LessonSection {
  title: string;
  markdown: string;
  image?: string;
}

export function parseLessonResponse(text: string): {
  content: string;
  estimatedMinutes: number;
  sources: { title: string; url: string; imageUrls?: string[] }[];
  quiz: { questions: QuizQuestion[]; passingScore: number };
  sections: LessonSection[];
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
    const parsed = JSON.parse(fixJsonControlChars(quizJson));
    if (parsed?.questions) {
      quiz = {
        questions: parsed.questions as QuizQuestion[],
        passingScore: parseInt(parsed.passingScore) || 70,
      };
    }
  } catch (err) {
    console.warn("[parse-lesson] quiz parse failed — saving lesson without questions:", err instanceof Error ? err.message : err);
    console.warn("[parse-lesson] raw quiz text:", quizRaw.slice(0, 300));
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

  return { content, estimatedMinutes, sources, quiz, sections };
}
