// Admin router – limited to specific admin user (davidbaeriksson@gmail.com)
// Provides curriculum-level management: list all curricula with lesson version summaries,
// and regenerate all lessons within a curriculum.

import { z } from "zod";
import { db, lessons, curricula, learningProfiles, quizzes, modelSettings } from "@bitebase/db";
import { protectedProcedure, router } from "../trpc";
import { generateText } from "ai";
import { eq, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomUUID } from "crypto";
import {
  getModel,
  ensureModelLoaded,
  PROMPT_VERSION,
  buildLessonSystemPrompt,
  buildNarrativeThreads,
  createWebSearchTool,
  parseLessonResponse,
  injectImagesIntoLesson,
} from "@bitebase/ai";

// Runtime model config — DB overrides → env vars → undefined (code defaults apply).
import { getEffectiveModelConfig } from "../lib/model-config";

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


/** Helper to ensure the caller is the designated admin.
 *  Reads from ADMIN_EMAIL env var; defaults to davidbaeriksson@gmail.com for backward compat. */
function ensureAdmin(email: string) {
  const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "davidbaeriksson@gmail.com";
  if (email !== ADMIN_EMAIL) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

// ── Simple in-memory rate limiter for expensive admin operations ────────────
// Prevents hammering of regenerate endpoints. Uses a sliding window per user.
// For distributed deployments, replace with Redis-based rate limiting.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, maxRequests: number, windowMs: number): void {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + windowMs });
    return;
  }
  entry.count++;
  if (entry.count > maxRequests) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs / 1000}s window.`,
    });
  }
}

/**
 * Regenerate a single lesson. Shared between regenerateLesson and regenerateLessonsByVersion.
 * Returns the lesson ID and new version.
 */
async function regenerateSingleLesson(lessonId: string): Promise<{ lessonId: string; newVersion: number }> {
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
  if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });

  const [curriculum] = await db.select().from(curricula).where(eq(curricula.id, lesson.curriculumId));
  if (!curriculum) throw new TRPCError({ code: "NOT_FOUND", message: "Curriculum not found" });

  // Load learning profile for the curriculum
  const [profile] = await db.select().from(learningProfiles).where(eq(learningProfiles.id, curriculum.profileId));
  if (!profile) throw new TRPCError({ code: "NOT_FOUND", message: "Learning profile not found" });

  // Re‑construct the curriculum plan from stored JSONB
  const plan = curriculum.sections as any;
  const curriculumPlan = { ...curriculum, sections: plan } as any;

  const narrativeThreads = buildNarrativeThreads(curriculumPlan);
  const safeProfile = { ...profile, additionalContext: profile.additionalContext ?? undefined };

  // Locate the order index of this lesson within the plan
  let orderIndex = -1;
  const allMeta: { id: string; order: number; section: any; subsection: any }[] = [];
  let order = 0;
  for (const sec of curriculumPlan.sections) {
    for (const sub of sec.subsections) {
      const metaId = sub.id;
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

  // Ensure the AI model is loaded (LLM Studio headless does not auto-load).
  await ensureModelLoaded();

  // Gather search context & images
  let searchContext = "";
  const searchImageUrls: string[] = [];
  if (searchTool) {
    try {
      const effectiveConfig = await getEffectiveModelConfig();
      const { text: searchResults, toolResults } = await generateText({
        ...effectiveConfig,
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
    const effectiveConfig = await getEffectiveModelConfig();
    const { text } = await generateText({
      ...effectiveConfig,
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
    if (!parsed.content || parsed.content.trim().length < 200) {
      console.error(`[admin] short content raw (first 600): ${(text || "<empty>").slice(0, 600)}`);
      throw new Error(`Lesson content too short (${parsed.content?.trim().length ?? 0} chars)`);
    }
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
    if (injected.sources) lessonData.sources = injected.sources;
  }

  // Only bump the lesson version if the prompt has changed since it was last generated.
  const promptChanged = lesson.promptVersion !== PROMPT_VERSION;
  await db
    .update(lessons)
    .set({
      content: lessonData.content,
      sources: lessonData.sources,
      estimatedMinutes: lessonData.estimatedMinutes,
      version: promptChanged ? lesson.version + 1 : lesson.version,
      promptVersion: PROMPT_VERSION,
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

  const newVersion = promptChanged ? lesson.version + 1 : lesson.version;
  return { lessonId: lesson.id, newVersion };
}

export const adminRouter = router({
  /** List all curricula with lesson version summaries. */
  listCurricula: protectedProcedure.query(async ({ ctx }) => {
    ensureAdmin(ctx.session.user.email);
    checkRateLimit(ctx.session.user.id, 30, 60_000); // 30 reads per minute

    // Get all curricula joined with lessons to derive version info
    const rows = await db
      .select({
        id: curricula.id,
        title: curricula.title,
        userId: curricula.userId,
        createdAt: curricula.createdAt,
        lessonVersion: lessons.version,
      })
      .from(curricula)
      .leftJoin(lessons, eq(lessons.curriculumId, curricula.id))
      .orderBy(sql`${curricula.createdAt} DESC`);

    // Group by curriculum
    const curriculumMap = new Map<
      string,
      { id: string; title: string; createdAt: Date; totalLessons: number; versionCounts: Map<number, number> }
    >();

    for (const row of rows) {
      let entry = curriculumMap.get(row.id);
      if (!entry) {
        entry = {
          id: row.id,
          title: row.title,
          createdAt: row.createdAt,
          totalLessons: 0,
          versionCounts: new Map(),
        };
        curriculumMap.set(row.id, entry);
      }
      if (row.lessonVersion !== null) {
        entry.totalLessons++;
        const current = entry.versionCounts.get(row.lessonVersion) ?? 0;
        entry.versionCounts.set(row.lessonVersion, current + 1);
      }
    }

    const curriculaList = Array.from(curriculumMap.values()).map((c) => ({
      id: c.id,
      title: c.title,
      totalLessons: c.totalLessons,
      createdAt: c.createdAt,
      versionSummary: Array.from(c.versionCounts.entries())
        .map(([version, count]) => ({ version, count }))
        .sort((a, b) => a.version - b.version),
    }));

    // Compute a global version rollup across ALL lessons
    const globalVersionMap = new Map<number, { version: number; totalLessons: number; curriculaCount: number; curricula: string[] }>();
    for (const c of curriculaList) {
      for (const vs of c.versionSummary) {
        let entry = globalVersionMap.get(vs.version);
        if (!entry) {
          entry = { version: vs.version, totalLessons: 0, curriculaCount: 0, curricula: [] };
          globalVersionMap.set(vs.version, entry);
        }
        entry.totalLessons += vs.count;
        entry.curriculaCount++;
        entry.curricula.push(c.title);
      }
    }
    const versionRollup = Array.from(globalVersionMap.values()).sort((a, b) => a.version - b.version);

    return { curricula: curriculaList, versionRollup };
  }),

  /** Regenerate all lessons within a curriculum. Returns results for each lesson. */
  regenerateCurriculum: protectedProcedure
    .input(z.object({ curriculumId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx.session.user.email);
      checkRateLimit(ctx.session.user.id, 2, 60_000); // 2 regenerations per minute (expensive AI calls)

      const allLessons = await db
        .select({ id: lessons.id })
        .from(lessons)
        .where(eq(lessons.curriculumId, input.curriculumId))
        .orderBy(lessons.order);

      if (allLessons.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "No lessons found for this curriculum" });
      }

      const results: { lessonId: string; newVersion: number }[] = [];
      for (const l of allLessons) {
        const result = await regenerateSingleLesson(l.id);
        results.push(result);
        // Brief pause between lessons to avoid hammering the AI endpoint
        await new Promise((res) => setTimeout(res, 500));
      }

      return { curriculumId: input.curriculumId, lessonResults: results };
    }),

  /** Regenerate all lessons at a given version number. Returns array of results. */
  regenerateLessonsByVersion: protectedProcedure
    .input(z.object({ version: z.number() }))
    .mutation(async ({ ctx, input }) => {
      ensureAdmin(ctx.session.user.email);
      checkRateLimit(ctx.session.user.id, 2, 60_000); // 2 regenerations per minute (expensive AI calls)
      const all = await db
        .select({ id: lessons.id, version: lessons.version })
        .from(lessons)
        .where(eq(lessons.version, input.version));
      const lessonIds = [...new Set(all.map((l) => l.id))];
      const results: { lessonId: string; newVersion: number }[] = [];
      for (const lessonId of lessonIds) {
        const result = await regenerateSingleLesson(lessonId);
        results.push(result);
        // Brief pause between lessons to avoid hammering the AI endpoint
        await new Promise((res) => setTimeout(res, 500));
      }
      return results;
    }),

  /** Read/write runtime model configuration (admin-managed overrides for env vars). */
  modelSettings: router({
    /** Return current DB settings with effective (DB→env→code-default) values. */
    get: protectedProcedure.query(async ({ ctx }) => {
      ensureAdmin(ctx.session.user.email);

      const row = await db
        .select()
        .from(modelSettings)
        .where(eq(modelSettings.id, "default"))
        .limit(1)
        .then((rows) => rows[0] ?? null);

      return {
        // Raw DB values (null = use env/code default)
        temperature: row?.temperature ?? null,
        maxTokens: row?.maxTokens ?? null,
        topP: row?.topP ?? null,
        // Effective values for display
        effectiveTemperature:
          row?.temperature ??
          (process.env.OLLAMA_TEMPERATURE
            ? parseFloat(process.env.OLLAMA_TEMPERATURE)
            : 0.7),
        effectiveMaxTokens:
          row?.maxTokens ??
          (process.env.OLLAMA_MAX_TOKENS
            ? parseInt(process.env.OLLAMA_MAX_TOKENS, 10)
            : null),
        effectiveTopP:
          row?.topP ??
          (process.env.OLLAMA_TOP_P
            ? parseFloat(process.env.OLLAMA_TOP_P)
            : null),
      };
    }),

    /** Persist model config overrides. Pass `null` to clear a DB override. */
    update: protectedProcedure
      .input(
        z.object({
          temperature: z.number().min(0).max(2).nullable(),
          maxTokens: z.number().int().min(1).nullable(),
          topP: z.number().min(0).max(1).nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        ensureAdmin(ctx.session.user.email);

        await db
          .insert(modelSettings)
          .values({
            id: "default",
            temperature: input.temperature,
            maxTokens: input.maxTokens,
            topP: input.topP,
            updatedAt: new Date(),
            updatedBy: ctx.session.user.email,
          })
          .onConflictDoUpdate({
            target: modelSettings.id,
            set: {
              temperature: input.temperature,
              maxTokens: input.maxTokens,
              topP: input.topP,
              updatedAt: new Date(),
              updatedBy: ctx.session.user.email,
            },
          });

        return { success: true };
      }),
  }),
});
