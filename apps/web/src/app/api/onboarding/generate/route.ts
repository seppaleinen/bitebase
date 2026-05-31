export const dynamic = "force-dynamic";

import { generateObject, generateText, NoObjectGeneratedError } from "ai";
import type { z } from "zod";
import {
  getModel,
  buildCurriculumSystemPrompt,
  buildLessonSystemPrompt,
  buildNarrativeThreads,
  curriculumPlanSchema,
  learningProfileSchema,
  createWebSearchTool,
  parseLessonResponse,
  type CurriculumPlan,
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

/**
 * Run tasks with at most `limit` concurrent executions.
 * Preserves result order. Waits for ALL tasks (like Promise.allSettled)
 * so in-flight work finishes before we inspect failures.
 */
async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const i = nextIndex++;
      if (i >= tasks.length) break;
      try {
        results[i] = { status: "fulfilled", value: await tasks[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.min(limit, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

const LESSON_CONCURRENCY = Math.max(1, parseInt(process.env.LESSON_GENERATION_CONCURRENCY ?? "3", 10));

/**
 * Call `fn(attempt)` up to `maxAttempts` times.
 * Passes the 1-based attempt number so callers can vary behaviour (e.g. temperature).
 * Waits `delayMs * attempt` between retries and logs each failure.
 */
async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  maxAttempts: number,
  delayMs: number,
  label = "task"
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[generate] ${label} attempt ${attempt}/${maxAttempts} failed: ${msg}`);
      if (attempt < maxAttempts) {
        await new Promise((res) => setTimeout(res, delayMs * attempt));
      }
    }
  }
  throw lastError;
}

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

/** Extract and parse a JSON object from model text that may be wrapped in markdown
 *  code fences, prefixed with prose, or wrapped in a JSON-Schema envelope. */
function extractJson(text: string): unknown {
  // Remove markdown code fences
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const raw = fenced ? fenced[1] : text.trim();

  // Find the outermost JSON object
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON object found in response");

  let jsonStr = raw.slice(start, end + 1);

  // Fix unescaped newlines/tabs inside string values (model sometimes outputs raw markdown)
  jsonStr = fixJsonControlChars(jsonStr);

  const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

  // Detect JSON-Schema envelope: {"type":"object","properties":{...}} and unwrap it
  if (
    parsed &&
    typeof parsed === "object" &&
    parsed.type === "object" &&
    parsed.properties &&
    typeof parsed.properties === "object"
  ) {
    return parsed.properties;
  }

  return parsed;
}

interface GenerateJsonParams {
  model: Parameters<typeof generateText>[0]["model"];
  system: string;
  prompt: string;
  mode?: "json" | "tool" | "auto";
  temperature?: number;
}

/**
 * Wraps `generateObject` with retry logic.
 * On `NoObjectGeneratedError`, logs the raw model text and attempts to parse
 * and validate it manually before giving up — a "repair" pass that handles
 * cases where the model produced valid JSON that just barely missed the schema.
 */
async function generateJsonObject<T>(
  params: GenerateJsonParams,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { object } = await generateObject({ ...params, schema });
      return object as T;
    } catch (err) {
      lastError = err;

      if (NoObjectGeneratedError.isInstance(err)) {
        const rawText = err.text ?? "";
        console.error(`[generate] attempt ${attempt}/${maxAttempts} schema mismatch.`);
        console.error(`[generate] finishReason: ${err.finishReason}`);
        console.error(`[generate] cause: ${err.cause instanceof Error ? err.cause.message : err.cause}`);
        console.error(`[generate] raw text (first 800 chars): ${rawText.slice(0, 800)}`);

        // Repair pass: try parsing the raw text ourselves
        try {
          const parsed = extractJson(rawText);
          const result = schema.safeParse(parsed);
          if (result.success) {
            console.warn(`[generate] repair pass succeeded on attempt ${attempt}`);
            return result.data;
          }
          console.error(`[generate] repair pass Zod errors:`, JSON.stringify(result.error.format()).slice(0, 600));
        } catch (parseErr) {
          console.error(`[generate] repair pass parse failed:`, parseErr instanceof Error ? parseErr.message : parseErr);
        }
      } else {
        console.error(`[generate] attempt ${attempt}/${maxAttempts} failed:`, err instanceof Error ? err.message : err);
      }

      if (attempt < maxAttempts) {
        await new Promise((res) => setTimeout(res, 1000 * attempt));
      }
    }
  }

  throw lastError;
}

function getSearchTool(includeImages = false) {
  if (process.env.SEARXNG_BASE_URL) {
    return createWebSearchTool({
      provider: "searxng",
      baseUrl: process.env.SEARXNG_BASE_URL,
      includeImages,
    });
  }
  if (process.env.TAVILY_API_KEY) {
    return createWebSearchTool({
      provider: "tavily",
      apiKey: process.env.TAVILY_API_KEY,
      includeImages,
    });
  }
  return null;
}

/**
 * POST /api/onboarding/generate
 *
 * Accepts a validated LearningProfile JSON body and responds with an SSE stream.
 * Events: `status` (progress message), `curriculum_created` (id + title),
 * `done` (final curriculumId), `error` (message string).
 *
 * Saves profile → generates curriculum plan → generates each lesson in order →
 * seeds the first lesson's progress row → marks the curriculum complete.
 */
export async function POST(req: Request) {
  const TEST_COOKIE = "__playwright_test__=1";
  const isTest = process.env.NODE_ENV !== "production" && req.headers.get("cookie")?.includes(TEST_COOKIE);
  type MinimalSession = { user: { id: string; name: string; email: string } };
  let session: MinimalSession | null = null;
  try {
    const raw = isTest
      ? { user: { id: "playwright-test-user", name: "Test User", email: "test@example.com" } }
      : await auth.api.getSession({ headers: req.headers });
    session = raw as MinimalSession | null;
  } catch (err) {
    console.error("[generate] session error:", err instanceof Error ? err.message : err);
    return new Response("Service unavailable", { status: 503 });
  }
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const bodyJson = await req.json();
  const { replaceCurriculumId, ...profileData } = bodyJson;
  const profileResult = learningProfileSchema.safeParse(profileData);
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
          additionalContext: profile.additionalContext,
        });

        send("status", { message: "Designing your curriculum..." });

        const curriculumPlan = await generateJsonObject<CurriculumPlan>(
          {
            model: getModel(),
            mode: "json",
            system: buildCurriculumSystemPrompt(profile),
            prompt: `Create a personalized curriculum for learning ${profile.topic} for a ${profile.experienceLevel} learner.`,
            temperature: 0.7,
          },
          curriculumPlanSchema
        );

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

        const searchTool = getSearchTool(true);
        const curriculumIdStr: string = curriculumId;

        interface LessonMeta {
          id: string;
          order: number;
          section: (typeof curriculumPlan.sections)[number];
          subsection: (typeof curriculumPlan.sections)[number]["subsections"][number];
        }

        const allLessonMeta: LessonMeta[] = [];
        let order = 0;
        for (const section of curriculumPlan.sections) {
          for (const subsection of section.subsections) {
            allLessonMeta.push({ id: randomUUID(), order: order++, section, subsection });
          }
        }
        const firstLessonId = allLessonMeta[0]?.id;

        send("lesson_list", {
          lessons: allLessonMeta.map((m) => ({
            title: m.subsection.title,
            section: m.section.title,
          })),
        });

        const curriculumOutline = allLessonMeta
          .map((m) => `${m.order + 1}. [${m.section.title}] ${m.subsection.title}`)
          .join("\n");

        const narrativeThreads = buildNarrativeThreads(curriculumPlan);

        const tasks = allLessonMeta.map((meta) => async () => {
          send("lesson_started", { title: meta.subsection.title });

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

              // Collect image URLs from tool results
              const searchToolResult = toolResults.find((r) => r.toolName === "webSearch");
              if (searchToolResult && typeof searchToolResult.result === "object" && searchToolResult.result !== null) {
                const results = (searchToolResult.result as { results?: { imageUrls?: string[] }[] }).results;
                if (Array.isArray(results)) {
                  for (const r of results) {
                    if (Array.isArray(r.imageUrls)) {
                      searchImageUrls.push(...r.imageUrls);
                    }
                  }
                }
              }
            } catch (err) {
              console.error(`[generate] search failed for "${meta.subsection.title}":`, err);
            }
          }

          // Temperature rises each retry so the model tries a different approach
          // instead of reproducing the same thin output.
          let lessonData: Awaited<ReturnType<typeof parseLessonResponse>> | null = null;
          try {
            lessonData = await withRetry(async (attempt) => {
              const temperature = Math.min(0.7 + (attempt - 1) * 0.15, 1.0);
              const { text } = await generateText({
                model: getModel(),
                system: buildLessonSystemPrompt(
                  profile,
                  meta.section.title,
                  meta.subsection.title,
                  curriculumOutline,
                  searchContext ||
                    `Focus on ${meta.subsection.title} as part of ${meta.section.title} in ${profile.topic}.`,
                  meta.order + 1,
                  allLessonMeta.length,
                  narrativeThreads[meta.order],
                ),
                prompt: `Write the complete lesson about "${meta.subsection.title}" for the section "${meta.section.title}".`,
                temperature,
              });
              if (process.env.NODE_ENV !== "production") {
                console.log(`[generate] lesson ${meta.order + 1} attempt ${attempt} raw (first 300): ${text.slice(0, 300)}`);
              }
              const parsed = parseLessonResponse(text);
              if (!parsed.content || parsed.content.trim().length < 200)
                throw new Error(`Lesson content too short (${parsed.content?.trim().length ?? 0} chars)`);
              return parsed;
            }, 3, 1000, `lesson "${meta.subsection.title}"`);
          } catch {
            // A single lesson failing should not abort the entire curriculum.
            // Save a placeholder so the card is still clickable and the user knows what happened.
            console.error(`[generate] lesson "${meta.subsection.title}" failed after all retries — saving placeholder`);
            lessonData = {
              content: `# ${meta.subsection.title}\n\nThis lesson could not be generated automatically. Try using the "Remake course" option from the dashboard to regenerate your curriculum.`,
              estimatedMinutes: 5,
              sources: [],
              quiz: { questions: [], passingScore: 70 },
            };
          }

          // Attach search images to sources if the model didn't provide any or as additional context
          const finalSources = (lessonData.sources || []).map((s) => ({
            ...s,
            imageUrls: s.imageUrls || (searchImageUrls.length > 0 ? searchImageUrls : undefined),
          }));

          await db.insert(lessons).values({
            id: meta.id,
            curriculumId: curriculumIdStr,
            sectionId: meta.section.id,
            subsectionId: meta.subsection.id,
            title: meta.subsection.title,
            content: lessonData.content,
            sources: finalSources,
            estimatedMinutes: lessonData.estimatedMinutes,
            order: meta.order,
          });
          await db.insert(quizzes).values({
            id: randomUUID(),
            lessonId: meta.id,
            questions: lessonData.quiz.questions,
            passingScore: lessonData.quiz.passingScore,
          });

          send("lesson_completed", { title: meta.subsection.title });
        });

        const settled = await runConcurrent(tasks, LESSON_CONCURRENCY);
        const failures = settled.filter((r) => r.status === "rejected");
        if (failures.length > 0) {
          const firstErr = (failures[0] as PromiseRejectedResult).reason;
          throw firstErr instanceof Error ? firstErr : new Error(String(firstErr));
        }

        if (firstLessonId) {
          await db.insert(progress).values({
            id: randomUUID(),
            userId: session.user.id,
            lessonId: firstLessonId,
            status: "available",
            quizAttempts: 0,
            lastAccessedAt: new Date(),
          });
        }

        await db
          .update(curricula)
          .set({ generationStatus: "complete" })
          .where(eq(curricula.id, curriculumId));

        // Non-destructive remake: delete old curriculum now that the new one is ready
        if (replaceCurriculumId && typeof replaceCurriculumId === "string" && replaceCurriculumId !== curriculumId) {
          try {
            await db.delete(curricula).where(eq(curricula.id, replaceCurriculumId));
          } catch (err) {
            // Best-effort; old curriculum may have been deleted already
            console.warn(`[generate] failed to remove old curriculum ${replaceCurriculumId}:`, err);
          }
        }

        send("done", { curriculumId });
      } catch (err) {
        console.error("[generate] fatal error:", err instanceof Error ? err.message : err);
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
