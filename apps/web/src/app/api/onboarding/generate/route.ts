export const dynamic = "force-dynamic";

import { generateObject, generateText, NoObjectGeneratedError } from "ai";
import type { z } from "zod";
import {
  getModel,
  buildCurriculumSystemPrompt,
  buildLessonSystemPrompt,
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

/** Call `fn` up to `maxAttempts` times, waiting `delayMs * attempt` between retries. */
async function withRetry<T>(fn: () => Promise<T>, maxAttempts: number, delayMs: number): Promise<T> {
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

        const searchTool = getSearchTool();

        let lessonOrder = 0;
        let firstLessonId: string | undefined;

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

            const lessonData = await withRetry(async () => {
              const { text } = await generateText({
                model: getModel(),
                system: buildLessonSystemPrompt(
                  profile,
                  section.title,
                  subsection.title,
                  searchContext ||
                    `Focus on ${subsection.title} as part of ${section.title} in ${profile.topic}.`
                ),
                prompt: `Write the complete lesson about "${subsection.title}" for the section "${section.title}".`,
                temperature: 0.7,
              });
              const parsed = parseLessonResponse(text);
              if (!parsed.content) throw new Error("Empty lesson content");
              return parsed;
            }, 3, 1000);

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
              firstLessonId = lessonId;
            }

            lessonOrder++;
          }
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
