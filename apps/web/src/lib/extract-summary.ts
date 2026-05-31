/**
 * Extract a summary/takeaways/conclusion section from lesson markdown.
 *
 * Heuristic:
 * - Find the LAST heading (## or ###) whose text matches summary keywords.
 * - Extract content from that heading up to the next heading at the same
 *   or higher level, or end of string.
 * - Returns { heading, bodyHtmlPreview } or null if nothing found.
 */

const SUMMARY_KEYWORDS =
  /\b(summary|takeaway|takeaways|conclusion|recap|key\s*points|wrap[\s-]*up|next\s*steps)\b/i;

type ExtractResult = {
  /** The heading text (without ## markers, trimmed) */
  heading: string;
  /** Full extracted section markdown (including the heading) */
  section: string;
  /** Content after the section (for splitting main content) */
  rest: string;
  /** Line index where the section starts in the original markdown */
  startLine: number;
  /** Line index where the section ends (exclusive) */
  endLine: number;
};

export function extractSummary(markdown: string): ExtractResult | null {
  if (!markdown) return null;

  const lines = markdown.split("\n");
  // Find all heading lines with their level and position
  const headings: Array<{ index: number; level: number; text: string }> = [];

  lines.forEach((line, i) => {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (match) {
      headings.push({
        index: i,
        level: match[1].length, // 2 or 3
        text: match[2].trim(),
      });
    }
  });

  if (headings.length === 0) return null;

  // Find LAST heading matching summary keywords
  let matchIdx = -1;
  for (let i = headings.length - 1; i >= 0; i--) {
    if (SUMMARY_KEYWORDS.test(headings[i].text)) {
      matchIdx = i;
      break;
    }
  }
  if (matchIdx === -1) return null;

  const matched = headings[matchIdx];
  const sectionStart = matched.index;

  // Find where this section ends: next heading at SAME or HIGHER level
  // (i.e., same # count or fewer #)
  let sectionEnd = lines.length;
  for (let i = matchIdx + 1; i < headings.length; i++) {
    if (headings[i].level <= matched.level) {
      sectionEnd = headings[i].index;
      break;
    }
  }

  const section = lines.slice(sectionStart, sectionEnd).join("\n");
  const rest = lines.slice(sectionEnd).join("\n");

  return {
    heading: matched.text,
    section,
    rest,
    startLine: sectionStart,
    endLine: sectionEnd,
  };
}

/**
 * Render a compact preview of markdown for the key takeaways card.
 * Strips the heading line, returns the body content.
 */
export function summaryBody(section: string): string {
  const lines = section.split("\n");
  // Remove the heading line (first line)
  const body = lines.slice(1).join("\n").trim();
  // Also strip any sub-headings (###) within the summary since the card
  // has its own layout and the sub-headings would add too much noise
  return body.replace(/^###\s+.*$/gm, "").trim();
}
