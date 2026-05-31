/**
 * Post-process lesson content to inject relevant images from web search
 * when the AI model didn't inline them during generation.
 *
 * Strategy:
 * 1. If lesson content already has inline images (`![...]`), leave it alone.
 * 2. Distribute available images across `##` section headings evenly.
 * 3. Skip the first heading (introduction) — inject after subsequent sections.
 */

/** Image URL with an optional caption derived from context */
export type LessonImage = { url: string; caption?: string };

/**
 * Inject images into lesson content at section breaks.
 *
 * @param content - Raw markdown lesson content
 * @param images - Image URLs gathered from web search (will be truncated to maxImages)
 * @param maxImages - Maximum images to inject (default 4)
 * @returns Modified content with images inserted, or original if conditions aren't met
 */
export function injectImagesIntoContent(
  content: string,
  images: (string | LessonImage)[],
  maxImages = 4,
): string {
  if (images.length === 0) return content;

  // Already has inline images — leave it alone
  if (/!\[[\s\S]*?\]\([\s\S]*?\)/.test(content)) return content;

  const lines = content.split("\n");

  // Find `## ` heading lines (not `### ` or deeper)
  const headingIndices: number[] = [];
  lines.forEach((line, i) => {
    if (/^## /.test(line)) headingIndices.push(i);
  });

  // Need at least 2 sections to justify injecting
  if (headingIndices.length < 2) return content;

  const available = images.slice(0, maxImages);
  const count = Math.min(available.length, headingIndices.length - 1, maxImages);

  // Distribute images across sections after the first heading
  const step = Math.max(1, Math.floor((headingIndices.length - 1) / count));
  const usedIndices = new Set<number>();

  for (let i = 0; i < count; i++) {
    const headingIdx = headingIndices[1 + i * step];
    if (usedIndices.has(headingIdx)) continue;
    usedIndices.add(headingIdx);

    const raw = available[i];
    const url = typeof raw === "string" ? raw : raw.url;
    const caption = typeof raw === "string" ? "" : raw.caption || "";

    const imageMarkdown = caption
      ? `\n\n![${caption}](${url})\n`
      : `\n\n![Illustration](${url})\n`;

    lines[headingIdx] = lines[headingIdx] + imageMarkdown;
  }

  return lines.join("\n");
}

/** Convenience: inject into a parsed lesson data structure. */
export function injectImagesIntoLesson<
  T extends { content: string },
>(lesson: T, images: (string | LessonImage)[], maxImages = 4): T {
  const newContent = injectImagesIntoContent(lesson.content, images, maxImages);
  if (newContent === lesson.content) return lesson;
  return { ...lesson, content: newContent };
}
