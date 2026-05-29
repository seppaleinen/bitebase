export const dynamic = "force-dynamic";

import { generateObject, generateText } from "ai";
import {
  getModel,
  buildCurriculumSystemPrompt,
  buildLessonSystemPrompt,
  curriculumPlanSchema,
  lessonContentSchema,
  learningProfileSchema,
  createWebSearchTool,
} from "@bitebase/ai";
import { auth } from "@bitebase/api";
import {
  db,
  learningProfiles,
  curricula,
  lessons,
  quizzes,
  progress,
} from "@bitebase/db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((res) => setTimeout(res, delayMs * attempt));
      }
    }
  }
  throw lastError;
}

function getSearchTool() {
  if (process.env.SEARXNG_BASE_URL) {
    return createWebSearchTool({
      provider: "searxng",
      baseUrl: process.env.SEARXNG_BASE_URL,
    });
  }
  if (process.env.TAVILY_API_KEY) {
    return createWebSearchTool({
      provider: "tavily",
      apiKey: process.env.TAVILY_API_KEY,
    });
  }
  return null;
}

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const bodyJson = await req.json();
  const profileResult = learningProfileSchema.safeParse(bodyJson);
  if (!profileResult.success) {
    return new Response(JSON.stringify({ error: "Invalid profile" }), {
      status: 400,
    });
  }
  const profile = profileResult.data;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ event, data })}\n\n`)
        );
      }

      let curriculumId: string | undefined;

      try {
        send("status", { message: "Saving your learning profile..." });

        const profileId = randomUUID();
        await db.insert(learningProfiles).values({
          id: profileId,
          userId: session.user.id,
          topic: profile.topic,
          experienceLevel: profile.experienceLevel,
          goals: profile.goals,
          availableMinutesPerDay: profile.availableMinutesPerDay,
          additionalContext: profile.additionalContext,
        });

        send("status", { message: "Designing your curriculum..." });

        const { object: curriculumPlan } = await generateObject({
          model: getModel(),
          schema: curriculumPlanSchema,
          mode: "json",
          system: buildCurriculumSystemPrompt(profile),
          prompt: `Create a personalized curriculum for learning ${profile.topic} for a ${profile.experienceLevel} learner.`,
          temperature: 0.7,
        });

        curriculumId = randomUUID();
        await db.insert(curricula).values({
          id: curriculumId,
          userId: session.user.id,
          profileId,
          title: curriculumPlan.title,
          description: curriculumPlan.description,
          totalEstimatedMinutes: curriculumPlan.totalEstimatedMinutes,
          sections: curriculumPlan.sections,
          generationStatus: "generating",
        });

        send("curriculum_created", {
          curriculumId,
          title: curriculumPlan.title,
          totalSections: curriculumPlan.sections.length,
        });

        const searchTool = getSearchTool();

        let lessonOrder = 0;
        const firstLessonId: string[] = [];

        for (const section of curriculumPlan.sections) {
          for (const subsection of section.subsections) {
            send("status", {
              message: `Creating lesson: ${subsection.title}...`,
            });

            let searchContext = "";
            if (searchTool) {
              try {
                const { text: searchResults } = await generateText({
                  model: getModel(),
                  tools: { webSearch: searchTool },
                  prompt: `Search for comprehensive information about "${subsection.title}" in the context of ${profile.topic} for a ${profile.experienceLevel} learner. Search for the most relevant and educational content.`,
                  maxSteps: 3,
                  temperature: 0.3,
                });
                searchContext = searchResults;
              } catch {
                // Web search failed, continue without it
              }
            }

            const { object: lessonData } = await withRetry(() =>
              generateObject({
                model: getModel(),
                schema: lessonContentSchema,
                mode: "json",
                system: buildLessonSystemPrompt(
                  profile,
                  section.title,
                  subsection.title,
                  searchContext ||
                    `Focus on ${subsection.title} as part of ${section.title} in ${profile.topic}.`
                ),
                prompt: `Write a complete lesson about "${subsection.title}" for the section "${section.title}".`,
                temperature: 0.7,
              })
            );

            const lessonId = randomUUID();
            await db.insert(lessons).values({
              id: lessonId,
              curriculumId,
              sectionId: section.id,
              subsectionId: subsection.id,
              title: subsection.title,
              content: lessonData.content,
              sources: lessonData.sources,
              estimatedMinutes: lessonData.estimatedMinutes,
              order: lessonOrder,
            });

            await db.insert(quizzes).values({
              id: randomUUID(),
              lessonId,
              questions: lessonData.quiz.questions,
              passingScore: lessonData.quiz.passingScore,
            });

            if (lessonOrder === 0) {
              firstLessonId.push(lessonId);
            }

            lessonOrder++;
          }
        }

        if (firstLessonId.length > 0) {
          await db.insert(progress).values({
            id: randomUUID(),
            userId: session.user.id,
            lessonId: firstLessonId[0],
            status: "available",
            quizAttempts: 0,
            lastAccessedAt: new Date(),
          });
        }

        await db
          .update(curricula)
          .set({ generationStatus: "complete" })
          .where(eq(curricula.id, curriculumId));

        send("done", { curriculumId });
      } catch (err) {
        if (curriculumId) {
          try {
            // Delete partial lessons (quizzes cascade via FK)
            await db
              .delete(lessons)
              .where(eq(lessons.curriculumId, curriculumId));
            await db
              .update(curricula)
              .set({ generationStatus: "failed" })
              .where(eq(curricula.id, curriculumId));
          } catch {
            // best-effort cleanup; don't mask the original error
          }
        }
        send("error", {
          message: err instanceof Error ? err.message : "Generation failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
