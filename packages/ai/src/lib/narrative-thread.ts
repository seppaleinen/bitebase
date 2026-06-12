import type { CurriculumPlan } from "../schemas";

/**
 * Build narrative thread strings for every lesson in a course plan.
 *
 * Each thread is a 1-2 sentence bridge that tells the lesson generator
 * what the learner should know coming into this lesson and why this topic
 * is the next logical step. This replaces the vague "build naturally on
 * what came before" instruction with concrete context derived from the
 * course plan's section/subsection titles and descriptions.
 *
 * For lesson 0 (the first), it sets the stage. For subsequent lessons,
 * it references the previous lesson's topic and describes the transition.
 *
 * Determinstic — zero AI calls, zero latency, consistent across retries.
 */
export function buildNarrativeThreads(coursePlan: CurriculumPlan): string[] {
  // Flatten all lessons in course order
  const allLessons: Array<{
    sectionTitle: string;
    subsectionTitle: string;
    subsectionDescription: string;
  }> = [];

  for (const section of coursePlan.sections) {
    for (const subsection of section.subsections) {
      allLessons.push({
        sectionTitle: section.title,
        subsectionTitle: subsection.title,
        subsectionDescription: subsection.description,
      });
    }
  }

  if (allLessons.length === 0) return [];

  return allLessons.map((lesson, i) => {
    if (i === 0) {
      return (
        `This is the first lesson. We will begin with "${lesson.subsectionTitle}" ` +
        `— ${lower(lesson.subsectionDescription)} within the broader context of ` +
        `"${lesson.sectionTitle}". Introduce the topic naturally; the learner has ` +
        `no prior knowledge of this course's content.`
      );
    }

    const prev = allLessons[i - 1];
    return (
      `In the previous lesson about "${prev.subsectionTitle}", we explored ` +
      `${lower(prev.subsectionDescription)}. Now let us turn to ` +
      `"${lesson.subsectionTitle}" — ${lower(lesson.subsectionDescription)}. ` +
      `Assume the learner has the knowledge described. You may briefly reference ` +
      `the previous lesson as a starting point.`
    );
  });
}

function lower(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
