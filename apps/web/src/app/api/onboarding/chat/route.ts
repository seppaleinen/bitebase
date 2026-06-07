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

  let result: Awaited<ReturnType<typeof streamText>>;
  try {
    result = streamText({
      model: getModel(),
      system: systemPrompt,
      messages,
      temperature: 0.7,
    });
  } catch (err) {
    // Initial connection failure — throw before any bytes are sent to the client.
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[onboarding/chat] streamText init failed:", msg);
    return new Response("Unable to connect to the AI model. Please check your connection and try again.", { status: 502 });
  }

  // Vercel AI SDK returns a DataStreamResponse even when streaming fails at the network level.
  // The body is null if no data was ever produced (e.g., auth rejected before first token).
  const response = result.toDataStreamResponse();
  if (!response.body) {
    console.error("[onboarding/chat] streamText returned empty body — LLM connection failed");
    return new Response("The AI model stopped responding. Please try again.", { status: 502 });
  }

  // Also check for non-OK status codes after streaming started (e.g., auth rejected mid-stream).
  if (response.status >= 400) {
    console.error("[onboarding/chat] streamText returned non-OK status:", response.status);
    return new Response("The AI model rejected the request. Please check your connection and try again.", { status: 502 });
  }

  return response;
}
