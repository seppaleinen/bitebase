export const dynamic = "force-dynamic";

import { streamText } from "ai";
import { getModel, ONBOARDING_SYSTEM_PROMPT } from "@bitebase/ai";
import { auth } from "@bitebase/api";
import { extractCollectedFields, type ChatMessage } from "@/lib/onboarding-state";

const TEST_COOKIE = "__playwright_test__=1";

function getTestSession() {
  return { user: { id: "playwright-test-user", name: "Test User", email: "test@example.com" } };
}

export async function POST(req: Request) {
  const isTest =
    process.env.NODE_ENV !== "production" &&
    req.headers.get("cookie")?.includes(TEST_COOKIE);

  let session: Awaited<ReturnType<typeof auth.api.getSession>> | ReturnType<typeof getTestSession> | null = null;
  try {
    session = isTest ? getTestSession() : await auth.api.getSession({ headers: req.headers });
  } catch (err) {
    console.error("[onboarding/chat] session error:", err instanceof Error ? err.message : err);
    return new Response("Service unavailable", { status: 503 });
  }

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = (await req.json()) as { messages: ChatMessage[] };

  const collectedSummary = extractCollectedFields(messages);
  const systemPrompt = `${ONBOARDING_SYSTEM_PROMPT}\n\nCurrent state — ${collectedSummary}`;

  if (process.env.NODE_ENV !== "production") {
    console.log("[onboarding/chat] state:", collectedSummary);
  }

  const result = streamText({
    model: getModel(),
    system: systemPrompt,
    messages,
    temperature: 0.7,
    onError({ error }: { error: unknown }) {
      console.error("[onboarding/chat] streamText error:", error);
    },
    onStepFinish({ finishReason, usage }: { finishReason: unknown; usage: unknown }) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[onboarding/chat] step:", { finishReason, usage });
      }
    },
  });

  return result.toDataStreamResponse();
}
