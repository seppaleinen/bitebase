/**
 * Extract **bolded terms** from lesson markdown for a "Key Terms" reference card.
 * Deduplicates, filters out noise (very short/long terms, common filler words),
 * and returns them sorted alphabetically.
 */

const COMMON_FILLER = new Set([
  "is", "it", "of", "in", "on", "at", "to", "for", "with", "by", "from",
  "as", "an", "or", "but", "not", "be", "are", "was", "were", "been",
  "have", "has", "had", "do", "does", "did", "the", "a", "and", "that",
  "this", "these", "those", "you", "your", "we", "our", "they", "their",
]);

export function extractKeyTerms(markdown: string): string[] {
  if (!markdown) return [];

  const seen = new Set<string>();
  const terms: string[] = [];

  // Match **text** — but not inside ```code blocks```
  // Strip code blocks first to avoid matching **inside** code
  const noCode = markdown.replace(/```[\s\S]*?```/g, "");

  // Also skip inline code `**text**`
  const noInlineCode = noCode.replace(/`[^`]+`/g, "");

  const regex = /\*\*(.+?)\*\*/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(noInlineCode)) !== null) {
    const term = match[1].trim();

    // Skip if term is too short, too long, or a common filler word
    if (term.length < 2) continue;
    if (term.length > 50) continue;
    if (COMMON_FILLER.has(term.toLowerCase())) continue;

    // Deduplicate (case-insensitive)
    const key = term.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    terms.push(term);
  }

  // Limit and sort alphabetically
  return terms.slice(0, 20).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase()),
  );
}
