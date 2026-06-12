export const dynamic = "force-dynamic";

import { generateText } from "ai";
import type { z } from "zod";
import {
  getModel,
  ensureModelLoaded,
  PROMPT_VERSION,
   buildCourseSystemPrompt,
  buildLessonSystemPrompt,
  buildNarrativeThreads,
  coursePlanSchema,
  learningProfileSchema,
  createWebSearchTool,
  parseLessonResponse,
  injectImagesIntoLesson,
  type CurriculumPlan,
} from "@bitebase/ai";
import { generateTtsAudio } from "@bitebase/ai/lib/tts";
import { auth, getEffectiveModelConfig } from "@bitebase/api";
import {
  db,
  learningProfiles,
  courses,
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
  maxTokens?: number;
  topP?: number;
}

/**
 * Wraps `generateText` with retry logic. Uses raw text mode (not json_object)
 * because LLM Studio / LiteLLM endpoints only support `text` and `json_schema` —
 * they reject `json_object`. We parse the raw model output ourselves and validate
 * against the Zod schema before returning.
 */
async function generateJsonObject<T>(
  params: GenerateJsonParams,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { text } = await generateText({
        ...params,
        mode: "text",
      });
      if (!text?.trim()) {
        throw new Error("Model returned empty response");
      }
      const parsed = extractJson(text);
      const result = schema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      console.error(`[generate] attempt ${attempt}/${maxAttempts} schema validation failed.`);
      console.error(`[generate] raw text (first 800 chars): ${text.slice(0, 800)}`);
      console.error(`[generate] Zod errors:`, JSON.stringify(result.error.format()).slice(0, 600));
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[generate] attempt ${attempt}/${maxAttempts} failed: ${msg}`);
    }

    if (attempt < maxAttempts) {
      await new Promise((res) => setTimeout(res, 1000 * attempt));
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
 * Events: `status` (progress message), `course_created` (id + title),
 * `done` (final courseId), `error` (message string).
 *
 * Saves profile → generates course plan → generates each lesson in order →
 * seeds the first lesson's progress row → marks the course complete.
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

      let courseId: string | undefined;

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

        send("status", { message: "Loading AI model..." });

        // Ensure the AI model is loaded (LLM Studio headless does not auto-load).
        await ensureModelLoaded();

        // Fetch runtime model config (DB overrides → env vars → code defaults).
        const modelKey = process.env.OLLAMA_MODEL ?? "llama3.2";
        const effectiveConfig = await getEffectiveModelConfig(modelKey);

        send("status", { message: "Designing your course..." });

        const coursePlan = await generateJsonObject<CurriculumPlan>(
          {
            model: getModel(),
            mode: "json",
            system:              buildCourseSystemPrompt(profile),
            prompt: `Create a personalized course for learning ${profile.topic} for a ${profile.experienceLevel} learner.`,
            temperature: (effectiveConfig.temperature as number | undefined) ?? 0.7,
            maxTokens: effectiveConfig.maxTokens as number | undefined,
            topP: effectiveConfig.topP as number | undefined,
          },
          coursePlanSchema
        );

        courseId = randomUUID();
        // Generate a kebab-case slug from the title
        const slug = coursePlan.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        await db.insert(courses).values({
          id: courseId,
          userId: session.user.id,
          profileId,
          title: coursePlan.title,
          slug,
          description: coursePlan.description,
          totalEstimatedMinutes: coursePlan.totalEstimatedMinutes,
          sections: coursePlan.sections,
          category: coursePlan.category || null,
          subcategory: coursePlan.subcategory || null,
          generationStatus: "generating",
        });

        send("course_created", {
          courseId,
          title: coursePlan.title,
          totalSections: coursePlan.sections.length,
        });

        const searchTool = getSearchTool(true);
        const courseIdStr: string = courseId;

        interface LessonMeta {
          id: string;
          order: number;
          section: (typeof coursePlan.sections)[number];
          subsection: (typeof coursePlan.sections)[number]["subsections"][number];
        }

        const allLessonMeta: LessonMeta[] = [];
        let order = 0;
        for (const section of coursePlan.sections) {
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

        const courseOutline = allLessonMeta
          .map((m) => `${m.order + 1}. [${m.section.title}] ${m.subsection.title}`)
          .join("\n");

        const narrativeThreads = buildNarrativeThreads(coursePlan);
        const isLanguageCourse = coursePlan.category === "Languages";

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
                maxTokens: effectiveConfig.maxTokens as number | undefined,
                topP: effectiveConfig.topP as number | undefined,
              });
              searchContext = searchResults;

              // Collect image URLs from tool results
              const searchToolResult = (toolResults as Array<{toolName: string; result: unknown}>).find((r) => r.toolName === "webSearch");
              if (searchToolResult && typeof searchToolResult.result === "object" && searchToolResult.result !== null) {
                const results = (searchToolResult.result as { results?: { imageUrls?: string[] }[] }).results;
                if (Array.isArray(results)) {
                  for (const r of results) {
                    if (Array.isArray(r.imageUrls)) {
                      for (const url of r.imageUrls) {
                        // Avoid duplicate URLs
                        if (!searchImageUrls.includes(url)) {
                          searchImageUrls.push(url);
                        }
                      }
                    }
                  }
                }
              }

              // Append image URLs to search context so the AI can see and use them
              if (searchImageUrls.length > 0) {
                searchContext += `\n\n---\nThe following relevant images are available. Include them in the lesson using standard markdown image syntax: ![description](url)\n`;
                searchImageUrls.slice(0, 8).forEach((url, i) => {
                  searchContext += `\n${i + 1}. ![Illustration ${i + 1}](${url})`;
                });
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
              const baseTemp = (effectiveConfig.temperature as number | undefined) ?? 0.7;
              const temperature = Math.min(baseTemp + (attempt - 1) * 0.15, 1.0);
              const { text } = await generateText({
                model: getModel(),
                system: buildLessonSystemPrompt(
                  profile,
                  meta.section.title,
                  meta.subsection.title,
                  courseOutline,
                  searchContext ||
                    `Focus on ${meta.subsection.title} as part of ${meta.section.title} in ${profile.topic}.`,
                  meta.order + 1,
                  allLessonMeta.length,
                  narrativeThreads[meta.order],
                  isLanguageCourse,
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
            // A single lesson failing should not abort the entire course.
            // Save a placeholder so the card is still clickable and the user knows what happened.
            console.error(`[generate] lesson "${meta.subsection.title}" failed after all retries — saving placeholder`);
            lessonData = {
              content: `# ${meta.subsection.title}\n\nThis lesson could not be generated automatically. Try using the "Remake course" option from the dashboard to regenerate your course.`,
              estimatedMinutes: 5,
              sources: [],
              quiz: { questions: [], passingScore: 70 },
              sections: [],
              vocabulary: [],
            };
          }

          // Post-process: inject search images inline if the AI didn't include any
          if (searchImageUrls.length > 0 && lessonData) {
            const beforeContent = lessonData.content;
            lessonData = injectImagesIntoLesson(lessonData, searchImageUrls, 4);
            if (lessonData.content !== beforeContent) {
              console.log(`[generate] injected ${(lessonData.content.match(/!\[.*?\]\(.*?\)/g) || []).length} image(s) into "${meta.subsection.title}"`);
            }
          }

          // Generate TTS audio for vocabulary items (language courses only)
          const audioClips: Array<{
            word: string;
            language: string;
            pronunciation: string;
            definition: string;
            audioDataUrl: string;
            durationMs: number;
          }> = [];
          if (isLanguageCourse && lessonData.vocabulary && lessonData.vocabulary.length > 0) {
            for (const item of lessonData.vocabulary) {
              const result = await generateTtsAudio(item.word, item.language);
              if (result) {
                audioClips.push({
                  word: item.word,
                  language: item.language,
                  pronunciation: item.pronunciation,
                  definition: item.definition,
                  audioDataUrl: result.audioDataUrl,
                  durationMs: result.durationMs,
                });
              }
            }
            if (audioClips.length > 0) {
              console.log(`[generate] generated ${audioClips.length} audio clip(s) for "${meta.subsection.title}"`);
            }
          }

          // Attach search images to sources if the model didn't provide any or as additional context
          const finalSources = (lessonData.sources || []).map((s) => ({
            ...s,
            imageUrls: s.imageUrls || (searchImageUrls.length > 0 ? searchImageUrls : undefined),
          }));

          await db.insert(lessons).values({
            id: meta.id,
            courseId: courseIdStr,
            sectionId: meta.section.id,
            subsectionId: meta.subsection.id,
            title: meta.subsection.title,
            content: lessonData.content,
            sources: finalSources,
            estimatedMinutes: lessonData.estimatedMinutes,
            order: meta.order,
            promptVersion: PROMPT_VERSION,
            audioClips,
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
          .update(courses)
          .set({ generationStatus: "complete" })
          .where(eq(courses.id, courseId));

        // Non-destructive remake: delete old course now that the new one is ready
        if (replaceCurriculumId && typeof replaceCurriculumId === "string" && replaceCurriculumId !== courseId) {
          try {
            await db.delete(courses).where(eq(courses.id, replaceCurriculumId));
          } catch (err) {
            // Best-effort; old course may have been deleted already
            console.warn(`[generate] failed to remove old course ${replaceCurriculumId}:`, err);
          }
        }

        send("done", { courseId });
      } catch (err) {
        console.error("[generate] fatal error:", err instanceof Error ? err.message : err);
        if (courseId) {
          try {
            // Delete partial lessons (quizzes cascade via FK)
            await db
              .delete(lessons)
              .where(eq(lessons.courseId, courseId));
            await db
              .update(courses)
              .set({ generationStatus: "failed" })
              .where(eq(courses.id, courseId));
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
