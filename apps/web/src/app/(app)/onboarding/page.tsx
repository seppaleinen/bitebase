"use client";

import { useChat } from "ai/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useRef, useEffect, Suspense } from "react";
import Link from "next/link";
import {
  Brain,
  Send,
  Loader2,
  Sparkles,
  CheckCircle,
  BookOpen,
  ChevronRight,
  Plus,
  Clock,
} from "lucide-react";
import type { LearningProfile } from "@bitebase/ai";
import { trpcReact } from "@/lib/trpc/provider";

type GenerationStatus = {
  event: string;
  data: {
    message?: string;
    curriculumId?: string;
    title?: string;
    totalSections?: number;
  };
};

// ── Returning-user gate ───────────────────────────────────────────────────────

function ReturningUserGate({ onStartNew }: { onStartNew: () => void }) {
  const { data: curricula, isLoading } = trpcReact.curriculum.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  // No existing curricula — skip the gate immediately
  if (!curricula || curricula.length === 0) {
    return null;
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600">
            <Brain className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back!</h1>
          <p className="mt-1 text-sm text-gray-500">
            Pick up where you left off or start something new.
          </p>
        </div>

        {/* Existing curricula */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Continue learning
          </p>
          {curricula.slice(0, 3).map((c) => (
            <Link
              key={c.id}
              href={`/curriculum/${c.id}`}
              className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition-all hover:border-violet-200 hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <BookOpen className="h-5 w-5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate font-semibold text-gray-900">{c.title}</p>
                <p className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  {Math.round(c.totalEstimatedMinutes / 60)}h total
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
            </Link>
          ))}
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-100" />
          <span className="text-xs text-gray-400">or</span>
          <div className="h-px flex-1 bg-gray-100" />
        </div>

        {/* Start new */}
        <button
          onClick={onStartNew}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 font-semibold text-white shadow-sm hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          Start a new lesson plan
        </button>
      </div>
    </div>
  );
}

// ── Chat interface ────────────────────────────────────────────────────────────

function OnboardingChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptParam = searchParams.get("prompt");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [finalizedProfile, setFinalizedProfile] =
    useState<LearningProfile | null>(null);

  const initialMessage = promptParam
    ? `I'd like to ${decodeURIComponent(promptParam)}`
    : null;

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: "/api/onboarding/chat",
      initialMessages: [
        {
          id: "welcome",
          role: "assistant",
          content: initialMessage
            ? `Great to see you again! Let me help you dive into that.\n\n${initialMessage}\n\nSounds exciting! Let me ask you a few quick questions to personalise this perfectly for you. First — how would you describe your current level with this topic?`
            : "Hi there! I'm BiteBase, your personal learning assistant. I'm here to help you create a curriculum tailored just for you.\n\nWhat topic or skill have you been wanting to learn? It could be anything — programming, cooking, history, music theory, a new language... the world is yours! 🌟",
        },
      ],
      onFinish(message) {
        // The model embeds a PROFILE: {...} line when it has all 4 required fields.
        // Parse it out and trigger generation — no tool calling needed.
        const match = message.content.match(/PROFILE:\s*(\{[\s\S]*?\})\s*$/m);
        if (match) {
          try {
            const profile = JSON.parse(match[1]) as LearningProfile;
            if (profile.topic && profile.experienceLevel && profile.goals && profile.availableMinutesPerDay >= 5) {
              setFinalizedProfile(profile);
            }
          } catch {
            // malformed JSON — ignore, let conversation continue
          }
        }
      },
    });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // If a prompt was pre-filled, send the first user message automatically
  useEffect(() => {
    if (promptParam && messages.length === 1) {
      void append({ role: "user", content: decodeURIComponent(promptParam) });
    }
  }, []);

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

  useEffect(() => {
    if (finalizedProfile) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      startGeneration(finalizedProfile);
    }
  }, [finalizedProfile]);

  return (
    <div className="flex h-full flex-col">
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
              This may take a minute while BiteBase researches and creates
              personalised lessons just for you.
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
            // Strip the PROFILE:{...} marker line before display
            const displayContent = m.content?.replace(/\n?PROFILE:\s*\{[\s\S]*?\}\s*$/m, "").trim();
            // Skip messages with no visible text
            if (!displayContent) return null;
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
                  <p className="whitespace-pre-wrap">{displayContent}</p>
                  {isAssistant && finalizedProfile && m === messages[messages.length - 1] && (
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
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-2 w-2 animate-bounce rounded-full bg-violet-400"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
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

// ── Page root ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const promptParam = searchParams.get("prompt");

  // If a ?prompt= is present (from post-lesson suggestions) skip the gate and
  // go straight into the chat — the user already knows what they want.
  const [showChat, setShowChat] = useState(!!promptParam);

  // ReturningUserGate internally returns null when there are no existing
  // curricula, so the first-time user just sees the chat immediately.
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

      {/* Body — gate or chat */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>}>
          {showChat ? (
            <OnboardingChat />
          ) : (
            <GateOrChat onStartNew={() => setShowChat(true)} />
          )}
        </Suspense>
      </div>
    </div>
  );
}

// Thin wrapper so the gate can short-circuit to the chat when no curricula exist
function GateOrChat({ onStartNew }: { onStartNew: () => void }) {
  const { data: curricula, isLoading } = trpcReact.curriculum.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!curricula || curricula.length === 0) {
    return <OnboardingChat />;
  }

  return <ReturningUserGate onStartNew={onStartNew} />;
}
