export const dynamic = "force-dynamic";

import { streamText } from "ai";
import { getModel, ONBOARDING_SYSTEM_PROMPT } from "@bitebase/ai";
import { auth } from "@bitebase/api";
import { extractCollectedFields, type ChatMessage } from "@/lib/onboarding-state";

const TEST_COOKIE = "__playwright_test__=1";

function getTestSession() {
  return { user: { id: "playwright-test-user", name: "Test User", email: "test@example.com" } };
}

/** Read first chunk from a stream with a timeout. Returns "timeout" if nothing arrives. */
async function readFirstChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
): Promise<ReadableStreamReadResult<Uint8Array> | "timeout"> {
  return Promise.race([
    reader.read(),
    new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), timeoutMs)),
  ]);
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
    console.log("[onboarding/chat] messages:", messages.length, "state:", collectedSummary);
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
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[onboarding/chat] streamText init failed:", msg);
    return new Response("Unable to connect to the AI model. Please check your connection and try again.", { status: 502 });
  }

  const response = result.toDataStreamResponse();

  if (!response.body) {
    console.error("[onboarding/chat] streamText returned null body");
    return new Response("The AI model stopped responding. Please try again.", { status: 502 });
  }

  if (response.status >= 400) {
    console.error("[onboarding/chat] streamText returned status:", response.status);
    return new Response("The AI model rejected the request. Please try again.", { status: 502 });
  }

  // Peek at the first chunk with a timeout to detect empty/stalled streams.
  // streamText can return a valid-looking DataStreamResponse (200, non-null body)
  // where the underlying LLM produces zero tokens (LiteLLM accepted the request
  // but Ollama returns immediately with no content).
  const reader = response.body.getReader();
  const firstChunk = await readFirstChunk(reader, 30000);

  if (firstChunk === "timeout") {
    console.error("[onboarding/chat] streamText timed out waiting for first chunk — LLM unresponsive");
    await reader.cancel().catch(() => {});
    return new Response("The AI model is not responding. Please try again.", { status: 502 });
  }

  if (firstChunk.done) {
    console.error("[onboarding/chat] streamText returned empty data stream — no tokens produced");
    return new Response("The AI model produced no response. Please try again.", { status: 502 });
  }

  // Stream the data starting with the peeked first chunk.
  const remainingStream = new ReadableStream({
    async start(controller) {
      controller.enqueue(firstChunk.value);
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            controller.close();
            return;
          }
          controller.enqueue(value);
        }
      } catch (err) {
        console.error("[onboarding/chat] stream read error:", err);
        controller.error(err);
      }
    },
  });

  return new Response(remainingStream, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
