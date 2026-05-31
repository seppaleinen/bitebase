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
  CheckCircle2,
  Circle,
  BookOpen,
  ChevronRight,
  Plus,
  Clock,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { LearningProfile } from "@bitebase/ai";
import type { AppRouter } from "@bitebase/api";
import { trpcReact } from "@/lib/trpc/provider";
import { extractProfileValues } from "@/lib/onboarding-state";

type GenerationStatus = {
  event: string;
  data: {
    message?: string;
    curriculumId?: string;
    title?: string;
    totalSections?: number;
    lessons?: { title: string; section: string }[];
  };
};

type LessonStatus = "pending" | "generating" | "done";
interface LessonProgress {
  title: string;
  section: string;
  status: LessonStatus;
}

// ?? Returning-user gate ???????????????????????????????????????????????????????

type CurriculumRow = inferRouterOutputs<AppRouter>["curriculum"]["list"][number];

function ReturningUserGate({
  curricula,
  onStartNew,
}: {
  curricula: CurriculumRow[];
  onStartNew: () => void;
}) {
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

// ?? Chat interface ????????????????????????????????????????????????????????????

function OnboardingChat() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const promptParam = searchParams.get("prompt");
  const isRefine = searchParams.get("refine") === "1";
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const confirmationRef = useRef<HTMLDivElement>(null);
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lessonProgressList, setLessonProgressList] = useState<LessonProgress[]>([]);
  const [finalizedProfile, setFinalizedProfile] =
    useState<LearningProfile | null>(null);

  // Read the stored profile once on mount for refine mode, then clear it to
  // prevent stale data on future visits.
  const [refineProfile] = useState<LearningProfile | null>(() => {
    if (!isRefine) return null;
    try {
      const stored = sessionStorage.getItem("bitebase_retry_profile");
      sessionStorage.removeItem("bitebase_retry_profile");
      return stored ? (JSON.parse(stored) as LearningProfile) : null;
    } catch {
      return null;
    }
  });

  const initialMessage = promptParam ? decodeURIComponent(promptParam) : null;

  const welcomeContent = refineProfile
    ? `Welcome back! Here's your previous learning profile:\n- Topic: ${refineProfile.topic}\n- Level: ${refineProfile.experienceLevel}\n- Goal: ${refineProfile.goals}\n\nWhat would you like to change? (e.g. "I want to focus more on conversation", "I'm actually intermediate level")`
    : initialMessage
    ? `Great choice! Let me help you build a curriculum around "${initialMessage}". I have a couple of quick questions to personalise it — what's your current level (beginner, intermediate, or advanced), and what's your main goal?`
    : "Hi there! I'm BiteBase, your personal learning assistant. I'm here to help you create a curriculum tailored just for you.\n\nWhat topic or skill have you been wanting to learn? It could be anything — programming, cooking, history, music theory, a new language... the world is yours! 🌍";

  const { messages, input, handleInputChange, handleSubmit, isLoading, append } =
    useChat({
      api: "/api/onboarding/chat",
      initialMessages: [
        {
          id: "welcome",
          role: "assistant",
          content: welcomeContent,
        },
      ],
    });

  // Derive quick-reply chips from the last AI question (client-side, no model involvement).
  const lastAssistantMessage = [...messages].reverse().find((m) => m.role === "assistant");
  const suggestions: string[] = (() => {
    if (!lastAssistantMessage || isLoading || finalizedProfile) return [];

    const allUserText = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join(" ")
      .toLowerCase();

    const alreadyHasLevel = /\b(beginner|intermediate|advanced)\b/.test(allUserText);

    const aiText = lastAssistantMessage.content.toLowerCase();
    const aiRaw = lastAssistantMessage.content; // preserve case for option extraction

    // Level chips — only when not yet answered.
    // Matches both explicit level questions ("what's your level") and natural
    // phrasing that mentions a level keyword in a question context.
    if (
      !alreadyHasLevel &&
      (/experience|your level|what level|how (advanced|experienced)/.test(aiText) ||
        (aiRaw.includes("?") && /\b(beginner|intermediate|advanced)\b/.test(aiText)))
    )
      return ["Beginner", "Intermediate", "Advanced"];

    // Generic: if the message contains a "?" try to extract "X or Y (or Z)" options
    // from the model's own phrasing, then fall back to a "No preference" chip.
    // Skip generic extraction for level questions when user already answered level.
    const isLevelQuestion = /experience|your level|what level|how (advanced|experienced)/.test(aiText) ||
      /\b(beginner|intermediate|advanced)\b/.test(aiText);
    if (alreadyHasLevel && isLevelQuestion) return [];
    if (aiRaw.includes("?")) {
      const orParts = aiRaw.split(/\bor\b/i);
      if (orParts.length >= 2 && orParts.length <= 5) {
        const extracted = orParts.map((part) => {
          // Take the last non-empty segment after splitting on commas
          const segments = part.split(",").map((s) => s.trim()).filter(Boolean);
          const candidate = segments[segments.length - 1] ?? part.trim();
          // Strip common question-preamble phrases
          const cleaned = candidate
            .replace(/^[\s?!.]+|[\s?!.]+$/g, "")
            .replace(
              /^(do you have a preference for|is your focus more on|are you (?:more )?interested in|would you (?:prefer|like)|do you prefer|a preference for)\s+/i,
              ""
            )
            .trim();
          const words = cleaned.split(/\s+/).filter((w) => /[a-zA-Z]/.test(w)).slice(0, 4);
          if (words.length === 0) return "";
          const joined = words.join(" ");
          return joined.charAt(0).toUpperCase() + joined.slice(1);
        }).filter((o) => o.length >= 2 && o.length <= 40);

        // Deduplicate and keep 2-4 options
        const unique = [...new Set(extracted)].slice(0, 4);
        if (unique.length >= 2) return [...unique, "No preference"];
      }
      // At minimum offer "No preference" for any unanswered question
      return ["No preference"];
    }

    return [];
  })();

  // Detect when all 3 profile fields have been collected.
  // Runs after every message update so it catches the tool-call path,
  // the PROFILE text-marker path, and the heuristic fallback.
  useEffect(() => {
    if (finalizedProfile || isLoading) return;

    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    let detected: LearningProfile | null = null;

    // Primary path: finalizeProfile tool was called and succeeded.
    // The Vercel AI SDK surfaces tool results in toolInvocations on the assistant message.
    const toolInvocations = (lastAssistant as unknown as { toolInvocations?: Array<{ toolName: string; state: string; result?: { success: boolean; profile?: LearningProfile } }> }).toolInvocations;
    const toolResult = toolInvocations?.find(
      (t) => t.toolName === "finalizeProfile" && t.state === "result" && t.result?.success
    );
    if (toolResult?.result?.profile) {
      const p = toolResult.result.profile;
      if (p.topic && p.experienceLevel && p.goals) detected = p;
    }

    // Secondary path: model emitted a PROFILE:{...} text marker.
    if (!detected) {
      const match = lastAssistant.content.match(/PROFILE:\s*(\{[^]*?\})/);
      if (match) {
        try {
          const p = JSON.parse(match[1]) as LearningProfile;
          if (p.topic && p.experienceLevel && p.goals) detected = p;
        } catch { /* fall through to heuristic */ }
      }
    }

    // Heuristic fallback: scan conversation history for all 3 fields.
    // No longer gated on "AI signals readiness" — if we have all 3 extractable
    // values and the AI has responded at least once, surface the card.
    if (!detected) {
      const chatMessages = messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));
      detected = extractProfileValues(chatMessages);
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (detected) setFinalizedProfile(detected);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isLoading]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (finalizedProfile) {
      confirmationRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [finalizedProfile]);

  // If a prompt was pre-filled, send the first user message automatically.
  // Intentionally runs once on mount — append and promptParam are stable.
  useEffect(() => {
    if (promptParam && messages.length === 1) {
      void append({ role: "user", content: promptParam });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startGeneration(profile: LearningProfile) {
    setIsGenerating(true);
    setGenerationError(null);
    setGenerationStatus("Starting curriculum generation...");
    setLessonProgressList([]);

    // Read and clear the pending replace-request from sessionStorage
    const replaceCurriculumId = sessionStorage.getItem("bitebase_replace_curriculum_id");
    sessionStorage.removeItem("bitebase_replace_curriculum_id");

    try {
      const response = await fetch("/api/onboarding/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(replaceCurriculumId ? { ...profile, replaceCurriculumId } : profile),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const msg = response.status === 503
          ? "The server is temporarily overloaded. Please wait a moment and try again."
          : `Generation failed (${response.status}). Please try again.`;
        setGenerationError(msg);
        console.error("[generation] server error:", response.status, text);
        setIsGenerating(false);
        return;
      }

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
            } else if (parsed.event === "lesson_list") {
              const { lessons } = parsed.data as { lessons: { title: string; section: string }[] };
              setLessonProgressList(lessons.map((l) => ({ ...l, status: "pending" })));
            } else if (parsed.event === "lesson_started") {
              const { title } = parsed.data as { title: string };
              setLessonProgressList((prev) =>
                prev.map((l) => l.title === title ? { ...l, status: "generating" } : l)
              );
            } else if (parsed.event === "lesson_completed") {
              const { title } = parsed.data as { title: string };
              setLessonProgressList((prev) =>
                prev.map((l) => l.title === title ? { ...l, status: "done" } : l)
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
      } else {
        setGenerationError("Generation completed but no curriculum was created. Please try again.");
        setIsGenerating(false);
      }
    } catch (err) {
      console.error("[onboarding] generation fetch error:", err);
      setGenerationError("Something went wrong connecting to the server. Please try again.");
      setIsGenerating(false);
    }
  }

  // Auto-generate: when navigated from dashboard "Try again", skip chat and
  // immediately start generation using the stored profile.
  // Runs once on mount — startGeneration is defined in the same scope.
  useEffect(() => {
    if (searchParams.get("autoGenerate") !== "1") return;
    const stored = sessionStorage.getItem("bitebase_retry_profile");
    if (!stored) return;
    sessionStorage.removeItem("bitebase_retry_profile");
    try {
      const profile = JSON.parse(stored) as LearningProfile;
      if (profile.topic && profile.experienceLevel) {
        setTimeout(() => startGeneration(profile), 0);
      }
    } catch {
      // malformed — fall back to normal chat
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Generation overlay */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-sm rounded-2xl border border-violet-100 bg-white p-6 shadow-xl">
            {/* Header */}
            <div className="mb-4 flex items-center gap-3">
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                <Sparkles className="h-6 w-6 text-violet-600" />
                <div className="absolute inset-0 animate-ping rounded-xl bg-violet-200 opacity-40" />
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900">Building your curriculum</h2>
                <p className="text-sm text-gray-500">Generating personalised lessons</p>
              </div>
            </div>

            {/* Lesson progress list */}
            {lessonProgressList.length > 0 ? (
              <>
                <div className="mb-3 flex items-center justify-between text-sm text-gray-500">
                  <span>
                    <span className="font-semibold text-emerald-600">
                      {lessonProgressList.filter((l) => l.status === "done").length}
                    </span>
                    {" of "}
                    <span className="font-semibold">{lessonProgressList.length}</span>
                    {" lessons ready"}
                  </span>
                  <span className="text-gray-400">
                    {lessonProgressList.filter((l) => l.status === "generating").length > 0 && "generating..."}
                  </span>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <ul className="space-y-1.5">
                    {lessonProgressList.map((lesson) => (
                      <li key={lesson.title} className="flex items-start gap-2.5 py-0.5">
                        {lesson.status === "done" ? (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                        ) : lesson.status === "generating" ? (
                          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-violet-500" />
                        ) : (
                          <Circle className="mt-0.5 h-4 w-4 shrink-0 text-gray-300" />
                        )}
                        <div className="min-w-0">
                          <p className={`truncate text-xs font-medium leading-tight ${
                            lesson.status === "done"
                              ? "text-gray-700"
                              : lesson.status === "generating"
                              ? "text-violet-700"
                              : "text-gray-400"
                          }`}>
                            {lesson.title}
                          </p>
                          <p className="truncate text-xs text-gray-400">{lesson.section}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {generationStatus && (
                  <p className="mt-3 text-center text-sm text-gray-400">{generationStatus}</p>
                )}
              </>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-500">
                  This may take a minute while BiteBase researches and creates
                  personalised lessons just for you.
                </p>
                <div className="rounded-xl bg-violet-50 px-4 py-3 text-sm text-violet-700">
                  <Loader2 className="mr-2 inline-block h-4 w-4 animate-spin" />
                  {generationStatus}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-none">
        <div className="mx-auto max-w-2xl space-y-6">
          {messages.map((m) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((m.role as any) === "tool") return null;
            // Strip PROFILE and SUGGESTIONS markers before display.
            // Use [^\]}]* (no nesting) + global flag to handle any ordering.
            const displayContent = m.content
              ?.replace(/SUGGESTIONS:\s*\[[^\]]*\]/g, "")
              .replace(/PROFILE:\s*\{[^}]*\}/g, "")
              .replace(/\n{3,}/g, "\n\n")
              .trim();
            // Skip messages with no visible text
            if (!displayContent) return null;
            const isAssistant = m.role === "assistant";

            return (
              <article
                key={m.id}
                role="listitem"
                aria-label={isAssistant ? `BiteBase: ${displayContent}` : `You: ${displayContent}`}
                className={`flex gap-3 animate-slide-up ${isAssistant ? "" : "flex-row-reverse"}`}
              >
                {isAssistant && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600" aria-hidden="true">
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
                      Profile ready ? see below to confirm
                    </div>
                  )}
                </div>
              </article>
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

      {/* Profile confirmation card */}
      {finalizedProfile && !isGenerating && (
        <div ref={confirmationRef} className="mx-6 mb-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <p className="mb-3 text-sm font-semibold text-emerald-800">Ready to generate your curriculum</p>
          <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-emerald-700">
            <span className="font-medium">Topic</span>
            <span className="capitalize">{finalizedProfile.topic}</span>
            <span className="font-medium">Level</span>
            <span className="capitalize">{finalizedProfile.experienceLevel}</span>
            <span className="font-medium">Goal</span>
            <span>{finalizedProfile.goals}</span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFinalizedProfile(null)}
              className="flex-1 rounded-xl border border-emerald-300 bg-white px-4 py-2 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
            >
              Edit answers
            </button>
            <button
              type="button"
              onClick={() => void startGeneration(finalizedProfile)}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-700"
            >
              Build my curriculum →
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {generationError && !isGenerating && (
        <div className="mx-6 mb-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {generationError}
        </div>
      )}

      {/* Input */}
      {!isGenerating && (
        <div className="border-t border-gray-100 bg-white px-6 pb-4 pt-3">
          <div className="mx-auto max-w-2xl space-y-3">
            {/* Quick-reply chips */}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      void append({ role: "user", content: s });
                    }}
                    className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-700 transition-colors hover:border-violet-400 hover:bg-violet-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-3"
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
        </div>
      )}
    </div>
  );
}

// ?? Page root ?????????????????????????????????????????????????????????????????

export default function OnboardingPage() {
  const searchParams = useSearchParams();
  const promptParam = searchParams.get("prompt");

  const autoGenerate = searchParams.get("autoGenerate") === "1";
  const refine = searchParams.get("refine") === "1";

  // Skip the gate if a prompt, autoGenerate, or refine flag is present.
  const [showChat, setShowChat] = useState(!!promptParam || autoGenerate || refine);

  // GateOrChat fetches curricula and short-circuits to the chat when there are
  // no active curricula, so first-time users see the chat immediately.
  return (
    <main className="flex h-screen flex-col bg-gradient-to-br from-violet-50 via-white to-indigo-50">
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

      {/* Body ? gate or chat */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-violet-400" /></div>}>
          {showChat ? (
            <OnboardingChat />
          ) : (
            <GateOrChat onStartNew={() => setShowChat(true)} />
          )}
        </Suspense>
      </div>
    </main>
  );
}

// Fetches curricula once and either short-circuits to the chat (no active curricula)
// or renders ReturningUserGate with the data already in hand ? no second query.
function GateOrChat({ onStartNew }: { onStartNew: () => void }) {
  const { data: curricula, isLoading } = trpcReact.curriculum.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  // Failed curricula shouldn't block access to the chat.
  const activeCurricula = curricula?.filter((c) => c.generationStatus !== "failed") ?? [];
  if (activeCurricula.length === 0) {
    return <OnboardingChat />;
  }

  return <ReturningUserGate curricula={activeCurricula} onStartNew={onStartNew} />;
}
