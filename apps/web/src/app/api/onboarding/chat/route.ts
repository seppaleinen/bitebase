export const dynamic = "force-dynamic";

import { streamText } from "ai";
import { getModel, ONBOARDING_SYSTEM_PROMPT, onboardingTools } from "@bitebase/ai";
import { auth } from "@bitebase/api";

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await req.json();

  const result = streamText({
    model: getModel(),
    system: ONBOARDING_SYSTEM_PROMPT,
    messages,
    tools: onboardingTools,
    maxSteps: 5,
    temperature: 0.7,
    onError({ error }) {
      console.error("[onboarding/chat] streamText error:", error);
    },
    onStepFinish({ stepType, toolCalls, toolResults, finishReason, usage }) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[onboarding/chat] step:", {
          stepType,
          finishReason,
          toolCalls: toolCalls.map((t) => t.toolName),
          usage,
        });
        if (toolResults.length > 0) {
          console.log("[onboarding/chat] toolResults:", JSON.stringify(toolResults, null, 2));
        }
      }
    },
  });

  return result.toDataStreamResponse();
}
