import { tool } from "ai";
import { z } from "zod";
import { learningProfileSchema } from "../schemas/index";

// Loose parameter schema — accepts whatever the model provides without hard-failing.
// Completeness is validated inside execute() so we can return a helpful error
// message the model can actually act on, rather than throwing an AI_TypeValidationError.
const finalizeProfileParamsSchema = z.object({
  topic: z.string().default(""),
  experienceLevel: z.string().default(""),
  goals: z.string().default(""),
  // optional; clear the value if the model outputs schema noise like "{'type':'string'}"
  additionalContext: z
    .string()
    .optional()
    .transform((v) =>
      v && (v.startsWith("{") || v.startsWith("[") || v === "null" || v === "undefined")
        ? undefined
        : v
    ),
});

export const finalizeProfileTool = tool({
  description:
    "Call this ONLY when you have confirmed all three required values from the user: topic, experienceLevel (beginner/intermediate/advanced), and goals (non-empty). Do not call with empty strings.",
  parameters: finalizeProfileParamsSchema,
  execute: async (raw) => {
    const missing: string[] = [];
    if (!raw.topic.trim()) missing.push("topic");
    if (!["beginner", "intermediate", "advanced"].includes(raw.experienceLevel))
      missing.push("experienceLevel (must be beginner, intermediate, or advanced)");
    if (!raw.goals.trim()) missing.push("goals");

    if (missing.length > 0) {
      return {
        success: false,
        error: `Still missing required information: ${missing.join(", ")}. Please ask the user for these before calling this tool again.`,
      };
    }

    const profile = learningProfileSchema.parse({
      ...raw,
      experienceLevel: raw.experienceLevel as "beginner" | "intermediate" | "advanced",
    });
    return { success: true, profile };
  },
});

type SearchConfig =
  | { provider: "tavily"; apiKey: string }
  | { provider: "searxng"; baseUrl: string };

type SearchResult = { title: string; url: string; content: string };

const searchInputSchema = z.object({
  query: z.string().describe("The search query to find relevant educational content"),
});

export function createWebSearchTool(config: SearchConfig) {
  return tool({
    description:
      "Search the web for up-to-date information on a topic to use in creating lesson content.",
    parameters: searchInputSchema,
    execute: async ({ query }): Promise<{ results: SearchResult[] }> => {
      if (config.provider === "tavily") {
        const response = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            query,
            search_depth: "advanced",
            max_results: 5,
          }),
        });
        if (!response.ok) return { results: [] };
        const data = (await response.json()) as { results: SearchResult[] };
        return {
          results: data.results.map((r) => ({
            title: r.title,
            url: r.url,
            content: r.content,
          })),
        };
      }

      // SearXNG
      try {
        const url = new URL("/search", config.baseUrl);
        url.searchParams.set("q", query);
        url.searchParams.set("format", "json");
        url.searchParams.set("categories", "general");
        const response = await fetch(url.toString());
        if (!response.ok) return { results: [] };
        const data = (await response.json()) as { results: SearchResult[] };
        return {
          results: (data.results ?? []).map((r) => ({
            title: r.title,
            url: r.url,
            content: r.content,
          })),
        };
      } catch {
        return { results: [] };
      }
    },
  });
}

/** @deprecated Use `createWebSearchTool({ provider: "tavily", apiKey })` instead. */
export const webSearchTool = (tavilyApiKey: string) =>
  createWebSearchTool({ provider: "tavily", apiKey: tavilyApiKey });

export const onboardingTools = {
  finalizeProfile: finalizeProfileTool,
};
