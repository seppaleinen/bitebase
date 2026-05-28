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

export const webSearchTool = (tavilyApiKey: string) =>
  tool({
    description:
      "Search the web for up-to-date information on a topic to use in creating lesson content.",
    parameters: z.object({
      query: z.string().describe("The search query"),
    }),
    execute: async ({ query }) => {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyApiKey,
          query,
          search_depth: "advanced",
          max_results: 5,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        return { results: [], error: "Search failed" };
      }

      const data = (await response.json()) as {
        results: Array<{ title: string; url: string; content: string }>;
      };
      return {
        results: data.results.map((r) => ({
          title: r.title,
          url: r.url,
          content: r.content,
        })),
      };
    },
  });

export const onboardingTools = {
  finalizeProfile: finalizeProfileTool,
};
