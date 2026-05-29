"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Clock,
  ExternalLink,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Lightbulb,
  AlertTriangle,
  BookOpen,
  Search,
  CheckCircle,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { trpcReact } from "@/lib/trpc/provider";
import { Badge } from "@bitebase/ui/web";
import QuizSection from "@/components/quiz-section";

/* ── Callout type detection ───────────────────────────────────────── */

function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return extractText((node as any).props.children);
  }
  return "";
}

function detectCalloutType(children: ReactNode): string | null {
  const text = extractText(children).trim();
  if (text.startsWith("💡") || text.startsWith("Tip:")) return "tip";
  if (text.startsWith("⚠️") || text.startsWith("Warning:")) return "warning";
  if (text.startsWith("📖") || text.startsWith("Definition:")) return "definition";
  if (text.startsWith("🔍") || text.startsWith("Deep Dive:")) return "deepdive";
  if (text.startsWith("✅") || text.startsWith("Success:")) return "success";
  return null;
}

const calloutIcon: Record<string, ReactNode> = {
  tip: <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />,
  definition: <BookOpen className="h-4 w-4 shrink-0 mt-0.5" />,
  deepdive: <Search className="h-4 w-4 shrink-0 mt-0.5" />,
  success: <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />,
};

const calloutIconColor: Record<string, string> = {
  tip: "text-amber-600",
  warning: "text-red-500",
  definition: "text-blue-600",
  deepdive: "text-violet-600",
  success: "text-emerald-600",
};

const markdownComponents: Components = {
  blockquote({ children }) {
    const type = detectCalloutType(children);
    const cls = type ? `callout-${type}` : "";
    return (
      <blockquote className={`${cls}`}>
        {type && (
          <div className={`mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${calloutIconColor[type]}`}>
            {calloutIcon[type]}
            <span>{type === "tip" ? "Tip" : type === "warning" ? "Warning" : type === "definition" ? "Definition" : type === "deepdive" ? "Deep Dive" : "Note"}</span>
          </div>
        )}
        <div className="[&>p]:my-0">{children}</div>
      </blockquote>
    );
  },
  hr() {
    return <hr />;
  },
};

/* ── Reading progress bar ─────────────────────────────────────────── */

function ReadingProgress() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    function handleScroll() {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return <div className="reading-progress" style={{ width: `${progress}%` }} />;
}

export default function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const utils = trpcReact.useUtils();
  const [showQuiz, setShowQuiz] = useState(false);

  const { data, isLoading, isError } = trpcReact.curriculum.getLesson.useQuery({
    lessonId: id,
  });

  const { data: curriculum } = trpcReact.curriculum.get.useQuery(
    { id: data?.lesson.curriculumId ?? "" },
    { enabled: !!data?.lesson.curriculumId }
  );

  const markStarted = trpcReact.curriculum.markLessonStarted.useMutation();

  const completeNoQuiz = trpcReact.curriculum.markLessonCompleted.useMutation({
    onSuccess: () => {
      void utils.curriculum.getLesson.invalidate({ lessonId: id });
      void utils.curriculum.getNextLesson.invalidate({ lessonId: id });
    },
  });

  const { data: nextLesson } = trpcReact.curriculum.getNextLesson.useQuery({ lessonId: id });

  const lessonId = data?.lesson?.id;
  const progressStatus = data?.progress?.status;
  useEffect(() => {
    if (lessonId && progressStatus === "available") {
      markStarted.mutate({ lessonId: id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, progressStatus]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">This lesson could not be loaded.</p>
        </div>
      </div>
    );
  }

  const { lesson, quiz, progress } = data;
  const isCompleted = progress?.status === "completed";
  const hasQuizQuestions = (quiz?.questions?.length ?? 0) > 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <ReadingProgress />

      {/* Back nav */}
      <Link
        href={`/curriculum/${lesson.curriculumId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to curriculum
      </Link>

      {/* Lesson header — hidden during quiz to avoid text-matching ambiguity */}
      {!showQuiz && (
        <div className="hero-pattern overflow-hidden rounded-2xl p-6 text-white shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Badge variant={isCompleted ? "success" : "secondary"}>
              {isCompleted ? "Completed" : "Lesson"}
            </Badge>
            <span className="flex items-center gap-1 text-xs text-white/70">
              <Clock className="h-3 w-3" />
              {lesson.estimatedMinutes} min read
            </span>
          </div>
          <p className="font-[family-name:var(--font-fraunces)] text-2xl font-bold leading-tight tracking-tight">
            {lesson.title}
          </p>
        </div>
      )}

      {/* Lesson content — hidden while quiz is active to avoid selector collisions */}
      {!showQuiz && (
        <div className="content-fade-in rounded-2xl border border-[#efe9e2] bg-[var(--color-card)] p-8 shadow-sm" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}>
          <div className="prose-lesson">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {lesson.content}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Sources */}
      {!showQuiz && lesson.sources && lesson.sources.length > 0 && (
        <div className="content-fade-in-delayed rounded-2xl border border-[#efe9e2] bg-[var(--color-card)] p-5 shadow-sm" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <h3 className="mb-3 font-[family-name:var(--font-fraunces)] text-sm font-semibold text-[var(--color-text-primary)]">
            Sources & Further Reading
          </h3>
          <ul className="space-y-2">
            {lesson.sources.map((source, i) => (
              <li key={i}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-[var(--color-accent)] hover:text-[var(--color-accent)] hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* No-quiz completion flow — shown when quiz is missing or has no questions */}
      {!hasQuizQuestions && (
        <div className="content-fade-in-delayed rounded-2xl border border-[#efe9e2] bg-[var(--color-card)] p-6 shadow-sm" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {isCompleted ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-[var(--color-secondary)] shrink-0" />
                <p className="text-sm font-medium text-[var(--color-secondary)]">Lesson completed!</p>
              </div>
              {nextLesson && (
                <Link
                  href={`/lesson/${nextLesson.id}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Next lesson
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          ) : (
            <div className="text-center">
              <p className="mb-4 text-sm text-[var(--color-text-muted)] font-[family-name:var(--font-literata)]">
                No quiz for this lesson. Mark it complete to unlock the next one.
              </p>
              <button
                onClick={() => completeNoQuiz.mutate({ lessonId: id })}
                disabled={completeNoQuiz.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {completeNoQuiz.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Mark as complete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quiz section */}
      {quiz && quiz.questions.length > 0 && (
        <div className="content-fade-in-delayed rounded-2xl border border-[#efe9e2] bg-[var(--color-card)] shadow-sm" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          {!showQuiz ? (
            <div className="p-6 text-center">
              <h3 className="mb-2 font-[family-name:var(--font-fraunces)] text-lg font-semibold text-[var(--color-text-primary)]">
                Ready to test your knowledge?
              </h3>
              <p className="mb-4 font-[family-name:var(--font-literata)] text-sm text-[var(--color-text-muted)]">
                Answer {quiz.questions.length} questions to complete this lesson.
                You need {quiz.passingScore}% to pass.
              </p>
              {isCompleted ? (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-sm font-medium text-[var(--color-secondary)]">
                    You passed this quiz with {progress?.quizScore}%!
                  </p>
                  <button
                    onClick={() => setShowQuiz(true)}
                    className="rounded-xl border border-[#d4c9bd] px-5 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[#f8f6f4] transition-colors"
                  >
                    Retake quiz
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Take the quiz
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <QuizSection
              lessonId={id}
              quiz={quiz}
              lessonTitle={lesson.title}
              curriculumId={lesson.curriculumId}
              curriculumTitle={curriculum?.title}
              onComplete={() => {
                utils.curriculum.getLesson.invalidate({ lessonId: id });
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
