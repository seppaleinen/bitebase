"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  Trophy,
  Plus,
  ChevronRight,
  Loader2,
  Sparkles,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { trpcReact } from "@/lib/trpc/provider";
import { Progress } from "@bitebase/ui/web";

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newCurriculumId = searchParams.get("new");

  const { data: session, isLoading: sessionLoading } =
    trpcReact.public.getSession.useQuery();

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.push("/login");
    }
  }, [session, sessionLoading, router]);

  const { data: courses, isLoading: coursesLoading } =
    trpcReact.course.list.useQuery(undefined, { enabled: !!session });

  if (sessionLoading || coursesLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent/60" />
      </div>
    );
  }

  const hasCurricula = courses && courses.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <main className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Learning</h1>
          <p className="mt-1 text-sm text-gray-500">
            {hasCurricula
              ? `${courses.length} active ${courses.length === 1 ? "course" : "courses"}`
              : "Start your first course"}
          </p>
        </div>
        {hasCurricula && (
          <Link
            href="/onboarding"
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark"
            aria-label="Create a new course"
          >
            <Plus className="h-4 w-4" />
            New course
          </Link>
        )}
      </div>

      {/* New course banner */}
      {newCurriculumId && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">
              Your course is ready!
            </p>
            <p className="text-xs text-emerald-600">
              Your personalized lessons and quizzes have been generated.
            </p>
          </div>
          <Link
            href={`/course/${newCurriculumId}`}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Start learning
          </Link>
        </div>
      )}

      {/* Empty state */}
      {!hasCurricula && (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light">
            <BookOpen className="h-8 w-8 text-accent" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            No courses yet
          </h3>
          <p className="mb-6 text-sm text-gray-500">
            Tell BiteBase what you want to learn and get a personalized
            course in minutes.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark"
          >
            <Sparkles className="h-4 w-4" />
            Create my first course
          </Link>
        </div>
      )}

      {/* Curriculum cards */}
      {hasCurricula && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CurriculumCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </main>
    </div>
  );
}

function CurriculumCard({
  course,
}: {
  course: {
    id: string;
    title: string;
    description: string;
    totalEstimatedMinutes: number;
    sections: unknown[];
    generationStatus: string;
    createdAt: Date | string;
  };
}) {
  const router = useRouter();
  const utils = trpcReact.useUtils();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isRedoing, setIsRedoing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleteMutation = trpcReact.course.delete.useMutation({
    onSuccess: () => utils.course.list.invalidate(),
  });

  const retryMutation = trpcReact.course.retryAndGetProfile.useMutation();

  const { data: lessonsData } = trpcReact.course.getLessons.useQuery({
    courseId: course.id,
  });

  const totalLessons = lessonsData?.length ?? 0;
  const completedLessons =
    lessonsData?.filter((l) => l.progress?.status === "completed").length ?? 0;
  const progressPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const isGenerating = course.generationStatus === "generating";
  const isFailed = course.generationStatus === "failed";
  const isMutating = isDeleting || isRetrying || isRedoing;

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmingDelete(true);
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmingDelete(false);
  }

  async function handleConfirmDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDeleting(true);
    try {
      await deleteMutation.mutateAsync({ id: course.id });
    } finally {
      setIsDeleting(false);
      setConfirmingDelete(false);
    }
  }

  async function handleRetry(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsRetrying(true);
    try {
      const data = await retryMutation.mutateAsync({ id: course.id });
      sessionStorage.setItem("bitebase_retry_profile", JSON.stringify(data));
      sessionStorage.setItem("bitebase_replace_course_id", data.courseId);
      router.push("/onboarding?autoGenerate=1");
    } catch {
      setIsRetrying(false);
    }
  }

  async function handleRedo(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsRedoing(true);
    try {
      const data = await retryMutation.mutateAsync({ id: course.id });
      sessionStorage.setItem("bitebase_retry_profile", JSON.stringify(data));
      sessionStorage.setItem("bitebase_replace_course_id", data.courseId);
      router.push("/onboarding?refine=1");
    } catch {
      setIsRedoing(false);
    }
  }

  const deleteConfirmButtons = (
    <div className="flex gap-2">
      <button
        onClick={handleCancelDelete}
        disabled={isDeleting}
        aria-label="Cancel delete"
        className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-300 transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        onClick={handleConfirmDelete}
        disabled={isDeleting}
        aria-label={isDeleting ? "Deleting course" : "Confirm delete"}
        className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-red-200 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
      >
        {isDeleting && <Loader2 className="h-3 w-3 animate-spin" />}
        {isDeleting ? "Deleting..." : "Confirm delete"}
      </button>
    </div>
  );

  const cardContent = (
    <>
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light">
          <BookOpen className="h-5 w-5 text-accent" />
        </div>
          {isGenerating && (
            <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
              <Loader2 className="h-3 w-3 animate-spin" />
              Generating
            </span>
          )}
          {isFailed && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
              Generation failed
            </span>
          )}
        {!isGenerating && !isFailed && progressPct === 100 && (
          <Trophy className="h-4 w-4 text-amber-500" />
        )}
      </div>

      <h3 className="mb-1 font-semibold text-gray-900 line-clamp-2 group-hover:text-accent-dark">
        {course.title}
      </h3>
      <p className="mb-4 text-xs text-gray-500 line-clamp-2">
        {course.description}
      </p>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>
              {completedLessons}/{totalLessons} lessons
            </span>
            <span>{progressPct}%</span>
          </div>
          <Progress value={progressPct} aria-label={`${progressPct}% complete`} role="progressbar" />
        </div>

      {/* Failed: Delete + Try again (try again still auto-generates) */}
      {isFailed && (
        <div className="border-t border-gray-100 pt-3 mt-3">
          {confirmingDelete ? deleteConfirmButtons : (
            <div className="flex gap-2">
              <button
                onClick={handleDeleteClick}
                disabled={isMutating}
                aria-label="Delete course"
                className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-500 hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
              <button
                onClick={handleRetry}
                disabled={isMutating}
                aria-label="Retry course generation"
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-accent py-1.5 text-xs font-medium text-white hover:bg-accent-dark transition-colors disabled:opacity-50"
              >
                {isRetrying && <Loader2 className="h-3 w-3 animate-spin" />}
                {isRetrying ? "Starting..." : "Try again"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Generating / active / complete: clock row + action buttons */}
      {!isFailed && (
        <>
          <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {Math.round(course.totalEstimatedMinutes / 60)}h total
            </span>
            {!isGenerating && (
              <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            )}
          </div>

          <div className="border-t border-gray-100 pt-3 mt-3">
            {confirmingDelete ? deleteConfirmButtons : isGenerating ? (
              /* Generating: Delete only, no Redo */
              <button
                onClick={handleDeleteClick}
                disabled={isMutating}
                aria-label="Delete course"
                className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" />
                Delete
              </button>
            ) : (
              /* Active / complete: Delete + Redo */
              <div className="flex gap-2">
                <button
                  onClick={handleDeleteClick}
                  disabled={isMutating}
                  aria-label="Delete course"
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-red-200 hover:text-red-600 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
                <button
                  onClick={handleRedo}
                  disabled={isMutating}
                  aria-label="Remake course"
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-accent-light hover:text-accent transition-colors disabled:opacity-50"
                >
                  {isRedoing ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3" />
                  )}
                  {isRedoing ? "Loading..." : "Remake course"}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );

  if (isFailed) {
    return (
      <div
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(`/course/${course.id}`);
          }
        }}
        aria-label={`Open ${course.title}`}
        className="group block cursor-pointer rounded-2xl border border-red-100 bg-white p-5 shadow-sm"
      >
        {cardContent}
      </div>
    );
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/course/${course.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/course/${course.id}`);
        }
      }}
      aria-label={`Open ${course.title}`}
      className="group block cursor-pointer p-5 card card-hover"
    >
      {cardContent}
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
