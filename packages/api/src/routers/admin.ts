// Admin router – limited to specific admin user (davidbaeriksson@gmail.com)
// Provides utilities to list lesson version statistics and to regenerate a lesson (creates a new version).

import { z } from "zod";
import { db, lessons, curricula, learningProfiles, quizzes, progress } from "@bitebase/db";
import { protectedProcedure, router } from "../trpc";
import { generateText } from "ai";
import { eq, and, inArray } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import {
  getModel,
  buildLessonSystemPrompt,
  buildNarrativeThreads,
  createWebSearchTool,
  parseLessonResponse,
  injectImagesIntoLesson,
} from "@bitebase/ai";

async function withRetry<T>(fn: (attempt: number) => Promise<T>, maxAttempts: number, delayMs: number, label = "task"): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      console.warn(`[admin] ${label} attempt ${attempt}/${maxAttempts} failed:`, err instanceof Error ? err.message : err);
      if (attempt < maxAttempts) {
        await new Promise((res) => setTimeout(res, delayMs * attempt));
      }
    }
  }
  throw lastError;
}


/** Helper to ensure the caller is the designated admin */
function ensureAdmin(email: string) {
  const ADMIN_EMAIL = "davidbaeriksson@gmail.com";
  if (email !== ADMIN_EMAIL) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

export const adminRouter = router({
  /** List each lesson with its current version and a count of how many rows exist for that lesson id+version.
   *  Returns [{ lessonId, version, count }]
   */
  listLessonVersions: protectedProcedure.query(async ({ ctx }) => {
    ensureAdmin(ctx.session.user.email);
    // Pull all lessons and aggregate in JS (drizzle aggregation is more verbose).
    const all = await db.select({ id: lessons.id, version: lessons.version }).from(lessons);
    const map = new Map<string, { version: number; count: number }>();
    for (const l of all) {
      const key = `${l.id}:${l.version}`;
      const entry = map.get(key) ?? { version: l.version, count: 0 };
      entry.count++;
      map.set(key, entry);
    }
    return Array.from(map.entries()).map(([key, { version, count }]) => {
      const [lessonId] = key.split(":");
      return { lessonId, version, count };
    });
  }),

  /** Regenerate a single lesson, storing the new content as a new version.
   *  Input: lessonId of the lesson to regenerate.
   */
  regenerateLesson: protectedProcedure
    .input(z.object({ lessonId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx.session.user.email);

      // Fetch existing lesson and its curriculum
      const [lesson] = await db.select().from(lessons).where(eq(lessons.id, input.lessonId));
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });

      const [curriculum] = await db.select().from(curricula).where(eq(curricula.id, lesson.curriculumId));
      if (!curriculum) throw new TRPCError({ code: "NOT_FOUND", message: "Curriculum not found" });

      // Load learning profile for the curriculum
      const [profile] = await db.select().from(learningProfiles).where(eq(learningProfiles.id, curriculum.profileId));
      if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Learning profile not found" });

      // Re‑construct the curriculum plan from stored JSONB
      const plan = curriculum.sections as any; // schema matches CurriculumPlan.sections
      const curriculumPlan = { ...curriculum, sections: plan } as any;

      const narrativeThreads = buildNarrativeThreads(curriculumPlan);
      const safeProfile = { ...profile, additionalContext: profile.additionalContext ?? undefined };


      // Locate the order index of this lesson within the plan
      let orderIndex = -1;
      const allMeta: { id: string; order: number; section: any; subsection: any }[] = [];
      let order = 0;
      for (const sec of curriculumPlan.sections) {
        for (const sub of sec.subsections) {
          const metaId = sub.id; // subsection ids are stored from original generation
          if (metaId === lesson.subsectionId) {
            orderIndex = order;
          }
          allMeta.push({ id: metaId, order, section: sec, subsection: sub });
          order++;
        }
      }
      if (orderIndex === -1) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found in curriculum plan" });

      const meta = allMeta[orderIndex];

      // Prepare search tool (include images)
        const searchTool = createWebSearchTool({
          provider: process.env.SEARXNG_BASE_URL ? "searxng" : "tavily",
          baseUrl: process.env.SEARXNG_BASE_URL ?? "",
          apiKey: process.env.TAVILY_API_KEY ?? "",
          includeImages: true,
        });

      // Gather search context & images
      let searchContext = "";
      const searchImageUrls: string[] = [];
      if (searchTool) {
        try {
          const { text: searchResults, toolResults } = await generateText({
            model: getModel(),
            tools: { webSearch: searchTool },
            prompt: `Search for comprehensive information about "${meta.subsection.title}" in the context of ${profile.topic} for a ${profile.experienceLevel} learner. Search for the most relevant and educational content.`,
            maxSteps: 3,
            temperature: 0.3,
          });
          searchContext = searchResults;
          const webResult = toolResults.find((r: { toolName: string }) => r.toolName === "webSearch");
          if (webResult && typeof webResult.result === "object" && webResult.result !== null) {
            const results = (webResult.result as any).results as any[] | undefined;
            if (Array.isArray(results)) {
// @ts-ignore
                for (const r of results) {
                if (Array.isArray(r.imageUrls)) {
                  for (const url of r.imageUrls) {
                    if (!searchImageUrls.includes(url)) searchImageUrls.push(url);
                  }
                }
              }
            }
          }
        } catch (e) {
          console.error("Admin lesson search failed", e);
        }
      }

      // Build full curriculum outline string (used by prompt)
      const curriculumOutline = allMeta
        .map((m) => `${m.order + 1}. [${m.section.title}] ${m.subsection.title}`)
        .join("\n");

      // Generate lesson content with retry logic
      const lessonData = await withRetry(async (attempt) => {
        const temperature = Math.min(0.7 + (attempt - 1) * 0.15, 1.0);
        const { text } = await generateText({
          model: getModel(),
            system: buildLessonSystemPrompt(
              safeProfile,
              meta.section.title,
              meta.subsection.title,

            curriculumOutline,
            searchContext || `Focus on ${meta.subsection.title} as part of ${meta.section.title} in ${profile.topic}.`,
            meta.order + 1,
            allMeta.length,
            narrativeThreads[meta.order]
          ),
          prompt: `Write the complete lesson about "${meta.subsection.title}" for the section "${meta.section.title}".`,
          temperature,
        });
        const parsed = parseLessonResponse(text);
        if (!parsed.content || parsed.content.trim().length < 200) throw new Error("Lesson content too short");
        return parsed;
      }, 3, 1000, `admin regenerate lesson ${meta.subsection.title}`);

      // Inject images if needed
      if (searchImageUrls.length > 0) {
        const before = lessonData.content;
        const injected = injectImagesIntoLesson(lessonData, searchImageUrls, 4);
        if (injected.content !== before) {
          console.log(`Admin injected images into lesson ${lesson.id}`);
        }
        lessonData.content = injected.content;
        // keep any new sources from injection
        if (injected.sources) lessonData.sources = injected.sources;
      }

      // Update the existing lesson row – increment version
      await db
        .update(lessons)
        .set({
          content: lessonData.content,
          sources: lessonData.sources,
          estimatedMinutes: lessonData.estimatedMinutes,
          version: lesson.version + 1,
        })
        .where(eq(lessons.id, lesson.id));

      // Replace the quiz for this lesson (delete old then insert new)
      await db.delete(quizzes).where(eq(quizzes.lessonId, lesson.id));
      await db.insert(quizzes).values({
        id: randomUUID(),
        lessonId: lesson.id,
        questions: lessonData.quiz.questions,
        passingScore: lessonData.quiz.passingScore,
      });

      return { lessonId: lesson.id, newVersion: lesson.version + 1 };
    }),
});
