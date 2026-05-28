import { tool } from "ai";
import { z } from "zod";
import { learningProfileSchema } from "../schemas/index";

export const finalizeProfileTool = tool({
  description:
    "Call this when you have gathered all the necessary information about the user's learning preferences. This finalizes the onboarding process and triggers curriculum generation.",
  parameters: learningProfileSchema,
  execute: async (profile) => {
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
