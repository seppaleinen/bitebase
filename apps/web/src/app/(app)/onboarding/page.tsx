"use client";

import { useChat } from "ai/react";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Brain, Send, Loader2, Sparkles, CheckCircle } from "lucide-react";
import type { LearningProfile } from "@bitebase/ai";

type GenerationStatus = {
  event: string;
  data: { message?: string; curriculumId?: string; title?: string; totalSections?: number };
};

export default function OnboardingPage() {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [finalizedProfile, setFinalizedProfile] = useState<LearningProfile | null>(null);

  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: "/api/onboarding/chat",
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Hi there! I'm BiteBase, your personal learning assistant. I'm here to help you create a curriculum tailored just for you. \n\nWhat topic or skill have you been wanting to learn? It could be anything — programming, cooking, history, music theory, a new language... the world is yours! 🌟",
      },
    ],
    onFinish(message) {
      // Check if the AI called finalizeProfile tool
      const toolCall = message.toolInvocations?.find(
        (t) => t.toolName === "finalizeProfile"
      );
      if (toolCall && "result" in toolCall && toolCall.result?.profile) {
        setFinalizedProfile(toolCall.result.profile as LearningProfile);
      }
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (finalizedProfile) {
      startGeneration(finalizedProfile);
    }
  }, [finalizedProfile]);

  async function startGeneration(profile: LearningProfile) {
    setIsGenerating(true);
    setGenerationStatus("Starting curriculum generation...");

    try {
      const response = await fetch("/api/onboarding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });

      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let curriculumId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          try {
            const parsed: GenerationStatus = JSON.parse(line.slice(6));
            if (parsed.event === "status") {
              setGenerationStatus(parsed.data.message ?? null);
            } else if (parsed.event === "curriculum_created") {
              curriculumId = parsed.data.curriculumId ?? null;
              setGenerationStatus(
                `Building ${parsed.data.totalSections} sections for "${parsed.data.title}"...`
              );
            } else if (parsed.event === "done") {
              curriculumId = parsed.data.curriculumId ?? curriculumId;
            } else if (parsed.event === "error") {
              setGenerationStatus(`Error: ${parsed.data.message}`);
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (curriculumId) {
        router.push(`/dashboard?new=${curriculumId}`);
      }
    } catch {
      setGenerationStatus("Something went wrong. Please try again.");
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-violet-50 via-white to-indigo-50">
      {/* Header */}
      <div className="border-b border-white/50 bg-white/80 backdrop-blur-sm px-6 py-4">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600">
            <Brain className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">BiteBase</p>
            <p className="text-xs text-gray-500">Learning assistant</p>
          </div>
        </div>
      </div>

      {/* Generation overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="mx-4 max-w-sm text-center">
            <div className="mb-6 flex justify-center">
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-violet-100">
                <Sparkles className="h-10 w-10 text-violet-600" />
                <div className="absolute inset-0 animate-ping rounded-full bg-violet-200 opacity-50" />
              </div>
            </div>
            <h2 className="mb-2 text-xl font-bold text-gray-900">
              Building your curriculum
            </h2>
            <p className="mb-6 text-sm text-gray-500">
              This may take a minute while BiteBase researches and creates personalized lessons just for you.
            </p>
            <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-700">
              <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
              {generationStatus}
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-none">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.map((m) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((m.role as any) === "tool") return null;
            const isAssistant = m.role === "assistant";

            return (
              <div
                key={m.id}
                className={`flex gap-3 animate-slide-up ${isAssistant ? "" : "flex-row-reverse"}`}
              >
                {isAssistant && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600">
                    <Brain className="h-4 w-4 text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    isAssistant
                      ? "bg-white text-gray-700 shadow-sm border border-gray-100"
                      : "bg-violet-600 text-white"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {/* Show finalize confirmation */}
                  {isAssistant && m.toolInvocations?.some(
                    (t) => t.toolName === "finalizeProfile"
                  ) && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Profile captured! Generating your curriculum...
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600">
                <Brain className="h-4 w-4 text-white" />
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-violet-400" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      {!isGenerating && (
        <div className="border-t border-gray-100 bg-white px-6 py-4">
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-2xl items-center gap-3"
          >
            <input
              value={input}
              onChange={handleInputChange}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none transition-all focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
