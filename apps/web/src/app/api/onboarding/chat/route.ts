export const dynamic = "force-dynamic";

import { streamText } from "ai";
import { getModel, ONBOARDING_SYSTEM_PROMPT } from "@bitebase/ai";
import { auth } from "@bitebase/api";

const TEST_COOKIE = "__playwright_test__=1";

function getTestSession() {
  return { user: { id: "playwright-test-user", name: "Test User", email: "test@example.com" } };
}

export async function POST(req: Request) {
  const isTest =
    process.env.NODE_ENV !== "production" &&
    req.headers.get("cookie")?.includes(TEST_COOKIE);

  const session = isTest
    ? getTestSession()
    : await auth.api.getSession({ headers: req.headers });

  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages } = await req.json();

  // No tools — llama3.2 via OpenAI-compat doesn't reliably execute tool calls.
  // The model is instructed to embed a PROFILE:{...} JSON line in its text when
  // it has gathered all 4 required fields; the client parses that marker.
  const result = streamText({
    model: getModel(),
    system: ONBOARDING_SYSTEM_PROMPT,
    messages,
    temperature: 0.7,
    onError({ error }) {
      console.error("[onboarding/chat] streamText error:", error);
    },
    onStepFinish({ finishReason, usage }) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[onboarding/chat] step:", { finishReason, usage });
      }
    },
  });

  return result.toDataStreamResponse();
}
