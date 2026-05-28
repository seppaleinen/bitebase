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
    maxSteps: 10,
    temperature: 0.7,
  });

  return result.toDataStreamResponse();
}
