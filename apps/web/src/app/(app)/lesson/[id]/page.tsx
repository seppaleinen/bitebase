"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  Bookmark,
} from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { trpcReact } from "@/lib/trpc/provider";
import { JsonLd } from "@/components/json-ld";
import { Badge } from "@bitebase/ui/web";
import QuizSection from "@/components/quiz-section";
import { LessonImage } from "@/components/lesson-image";
import {
  SectionNavigator,
  parseSections,
} from "@/components/lesson-section-nav";
import { extractSummary, summaryBody } from "@/lib/extract-summary";
import { extractKeyTerms } from "@/lib/extract-terms";
import { VocabularySection } from "@/components/audio-player";

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
  deepdive: "text-accent",
  success: "text-emerald-600",
};

const markdownComponents: Components = {
  blockquote({ children }) {
    const type = detectCalloutType(children);
    const cls = type ? `callout-${type}` : "";
    return (
      <blockquote className={`${cls}`}>
        {type && (
          <>
            <div className={`flex items-center gap-1.5 ${calloutIconColor[type]}`}>
              {calloutIcon[type]}
              <span className="text-xs font-bold uppercase tracking-wider">{type === "tip" ? "Tip" : type === "warning" ? "Warning" : type === "definition" ? "Definition" : type === "deepdive" ? "Deep Dive" : "Note"}</span>
            </div>
            <div className="my-2 border-t border-current opacity-15" />
          </>
        )}
        <div className="[&>p]:my-0">{children}</div>
      </blockquote>
    );
  },
  h2({ children, ...rest }) {
    // Build a slug from heading text for anchor linking
    const text = extractText(children);
    const slug = text
      .toLowerCase()
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || undefined;
    return <h2 id={slug} {...rest}>{children}</h2>;
  },
  hr() {
    return <hr />;
  },
  img({ src, alt }) {
    return <LessonImage src={src} alt={alt} />;
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

  return (
    <div
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      className="fixed left-0 top-0 h-1 bg-accent transition-all"
      style={{ width: `${progress}%` }}
    />
  );
}

function useUser() {
  const { data, isLoading } = trpcReact.public.getSession.useQuery();
  return { user: data ?? null, isLoading };
}

export default function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useUser();
  const utils = trpcReact.useUtils();
  const [showQuiz, setShowQuiz] = useState(false);

  const { data, isLoading, isError } =
    trpcReact.public.getPublishedLesson.useQuery({
      lessonId: id,
    });

  const { data: curriculum } = trpcReact.public.getPublishedCurriculum.useQuery(
    { id: data?.lesson.curriculumId ?? "" },
    { enabled: !!data?.lesson.curriculumId }
  );

  const { data: userProgress } =
    trpcReact.curriculum.getLessonProgress.useQuery(
      { lessonId: id },
      { enabled: !!user }
    );

  const markStarted = trpcReact.curriculum.markLessonStarted.useMutation();

  const completeNoQuiz = trpcReact.curriculum.markLessonCompleted.useMutation({
    onSuccess: () => {
      void utils.curriculum.getLessonProgress.invalidate({ lessonId: id });
      void utils.curriculum.getNextLesson.invalidate({ lessonId: id });
    },
  });

  const { data: nextLesson } = trpcReact.curriculum.getNextLesson.useQuery(
    { lessonId: id },
    { enabled: !!user }
  );

  const lessonId = data?.lesson?.id;
  const progressStatus = userProgress?.status;
  useEffect(() => {
    if (lessonId && progressStatus === "available" && markStarted.isIdle) {
      markStarted.mutate({ lessonId: id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, progressStatus]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent/60" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href="/explore"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to explore
        </Link>
        <div className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-gray-500">This lesson could not be loaded.</p>
        </div>
      </div>
    );
  }

  const { lesson, quiz } = data;
  const isCompleted = userProgress?.status === "completed";
  const hasQuizQuestions = (quiz?.questions?.length ?? 0) > 0;

  // Extract summary/takeaways section for a dedicated card
  const summaryInfo = extractSummary(lesson.content);
  const mainContent = summaryInfo
    ? lesson.content
        .split("\n")
        .slice(0, summaryInfo.startLine)
        .concat(
          lesson.content
            .split("\n")
            .slice(summaryInfo.endLine)
        )
        .join("\n")
        .trim()
    : lesson.content;

  // Parse sections for navigator, extract key terms
  const sections = parseSections(mainContent);
  const keyTerms = extractKeyTerms(mainContent);

  function handleSignInToQuiz() {
    router.push(`/login?redirect=/lesson/${id}`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      {/* Structured data for search engines + AI answer engines */}
      {lesson && (
        <>
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: process.env.SITE_URL ?? "https://bitebase.labb.site",
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Explore",
                  item: `${
                    process.env.SITE_URL ?? "https://bitebase.labb.site"
                  }/explore`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: curriculum?.title ?? "Curriculum",
                  item: `${
                    process.env.SITE_URL ?? "https://bitebase.labb.site"
                  }/curriculum/${lesson.curriculumId}`,
                },
                {
                  "@type": "ListItem",
                  position: 4,
                  name: lesson.title,
                },
              ],
            }}
          />
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "LearningResource",
              name: lesson.title,
              description: lesson.content?.slice(0, 300) ?? "",
              timeRequired: `PT${lesson.estimatedMinutes}M`,
              isPartOf: curriculum
                ? {
                    "@type": "Course",
                    name: curriculum.title,
                    url: `${
                      process.env.SITE_URL ?? "https://bitebase.labb.site"
                    }/curriculum/${lesson.curriculumId}`,
                  }
                : undefined,
            }}
          />
        </>
      )}

      <ReadingProgress />

      {/* Back nav */}
      <Link
        href={`/curriculum/${lesson.curriculumId}`}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
        aria-label="Back to curriculum"
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
            <span className="flex items-center gap-1 text-sm text-white/70">
              <Clock className="h-3 w-3" />
              {lesson.estimatedMinutes} min read
            </span>
          </div>
          <p className="font-[family-name:var(--font-fraunces)] text-2xl font-bold leading-tight tracking-tight">
            {lesson.title}
          </p>
        </div>
      )}

      {/* Section navigator */}
      {!showQuiz && <SectionNavigator sections={sections} />}

      {/* Lesson content — hidden while quiz is active to avoid selector collisions */}
      {!showQuiz && (
        <div className="content-fade-in rounded-2xl border border-[#efe9e2] bg-[var(--color-card)] p-8 shadow-sm" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 16px rgba(0,0,0,0.04)" }}>
          <div className="prose-lesson">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {mainContent}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Key Takeaways card */}
      {!showQuiz && summaryInfo && (() => {
        const body = summaryBody(summaryInfo.section);
        if (!body) return null;
        return (
          <div className="content-fade-in-delayed rounded-2xl border border-amber-200/60 bg-amber-50/70 p-6 shadow-sm" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-200/70 text-xs">🎯</span>
              <h3 className="font-[family-name:var(--font-fraunces)] text-base font-semibold text-[var(--color-text-primary)]">
                Key Takeaways
              </h3>
            </div>
            <div className="prose-lesson text-sm [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul:last-child]:mb-0 [&_li]:mb-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                {body}
              </ReactMarkdown>
            </div>
          </div>
        );
      })()}

      {/* Vocabulary & Pronunciation — audio clips from language courses */}
      {!showQuiz && lesson.audioClips && lesson.audioClips.length > 0 && (
        <VocabularySection clips={lesson.audioClips} />
      )}

      {/* Visual References — deduplicated by URL */}
      {!showQuiz && (() => {
        const seenUrls = new Set<string>();
        const images = (lesson.sources || []).flatMap(s =>
          (s.imageUrls || [])
            .filter(url => {
              if (seenUrls.has(url)) return false;
              seenUrls.add(url);
              return true;
            })
            .map(url => ({ url, title: s.title }))
        );
        if (images.length === 0) return null;
        return (
          <div className="content-fade-in-delayed rounded-2xl border border-[#efe9e2] bg-[var(--color-card)] p-5 shadow-sm" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
            <h3 className="mb-4 font-[family-name:var(--font-fraunces)] text-sm font-semibold text-[var(--color-text-primary)]">
              Visual References
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {images.map(({ url, title }) => (
                <a 
                  key={url} 
                  href={url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group relative aspect-video overflow-hidden rounded-lg border border-[#efe9e2]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={url} 
                    alt={title} 
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    onError={(e) => {
                      (e.target as HTMLImageElement).closest("a")?.remove();
                    }}
                  />
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <p className="truncate text-[10px] font-medium text-white">{title}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        );
      })()}

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

      {/* Key Terms card */}
      {!showQuiz && keyTerms.length > 0 && (
        <div className="content-fade-in-delayed rounded-2xl border border-[#efe9e2] bg-[var(--color-card)] p-5 shadow-sm" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <h3 className="mb-3 flex items-center gap-2 font-[family-name:var(--font-fraunces)] text-sm font-semibold text-[var(--color-text-primary)]">
            <Bookmark className="h-3.5 w-3.5 text-[var(--color-accent)]" />
            Key Terms
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {keyTerms.map((term) => (
              <code
                key={term}
                className="rounded-md bg-[#f2ede8] px-2 py-0.5 text-xs font-medium text-[var(--color-text-primary)]"
              >
                {term}
              </code>
            ))}
          </div>
        </div>
      )}

      {/* No-quiz completion flow — only for authenticated users */}
      {!hasQuizQuestions && user && (
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

      {/* Sign-in prompt for anonymous users with no-quiz lessons */}
      {!hasQuizQuestions && !user && (
        <div className="content-fade-in-delayed rounded-2xl border border-[#efe9e2] bg-[var(--color-card)] p-6 text-center shadow-sm" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <p className="mb-4 text-sm text-[var(--color-text-muted)] font-[family-name:var(--font-literata)]">
            Sign in to track your progress across lessons.
          </p>
          <Link
            href={`/login?redirect=/lesson/${id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Sign in to continue
            <ChevronRight className="h-4 w-4" />
          </Link>
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
                    You passed this quiz with {userProgress?.quizScore}%!
                  </p>
                  <button
                    onClick={() => setShowQuiz(true)}
                    className="rounded-xl border border-[#d4c9bd] px-5 py-2 text-sm font-medium text-[var(--color-text-muted)] hover:bg-[#f8f6f4] transition-colors"
                  >
                    Retake quiz
                  </button>
                </div>
              ) : user ? (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Take the quiz
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={handleSignInToQuiz}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                >
                  Sign in to take quiz
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
                utils.curriculum.getLessonProgress.invalidate({ lessonId: id });
                utils.curriculum.getNextLesson.invalidate({ lessonId: id });
              }}
            />
          )}
        </div>
      )}
    </main>
  );
}
