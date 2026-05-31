"use client";

import { useState } from "react";
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
  const searchParams = useSearchParams();
  const newCurriculumId = searchParams.get("new");

  const { data: curricula, isLoading } = trpcReact.curriculum.list.useQuery();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  const hasCurricula = curricula && curricula.length > 0;

  return (
    <main className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Learning</h1>
          <p className="mt-1 text-sm text-gray-500">
            {hasCurricula
              ? `${curricula.length} active ${curricula.length === 1 ? "curriculum" : "curricula"}`
              : "Start your first curriculum"}
          </p>
        </div>
        {hasCurricula && (
          <Link
            href="/onboarding"
            className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            aria-label="Create a new course"
          >
            <Plus className="h-4 w-4" />
            New course
          </Link>
        )}
      </div>

      {/* New curriculum banner */}
      {newCurriculumId && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4">
          <Sparkles className="h-5 w-5 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">
              Your curriculum is ready!
            </p>
            <p className="text-xs text-emerald-600">
              Your personalized lessons and quizzes have been generated.
            </p>
          </div>
          <Link
            href={`/curriculum/${newCurriculumId}`}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Start learning
          </Link>
        </div>
      )}

      {/* Empty state */}
      {!hasCurricula && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
            <BookOpen className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            No courses yet
          </h3>
          <p className="mb-6 text-sm text-gray-500">
            Tell BiteBase what you want to learn and get a personalized
            curriculum in minutes.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            <Sparkles className="h-4 w-4" />
            Create my first course
          </Link>
        </div>
      )}

      {/* Curriculum cards */}
      {hasCurricula && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {curricula.map((curriculum) => (
            <CurriculumCard key={curriculum.id} curriculum={curriculum} />
          ))}
        </div>
      )}
    </main>
  );
}

function CurriculumCard({
  curriculum,
}: {
  curriculum: {
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

  const deleteMutation = trpcReact.curriculum.delete.useMutation({
    onSuccess: () => utils.curriculum.list.invalidate(),
  });

  const retryMutation = trpcReact.curriculum.retryAndGetProfile.useMutation();

  const { data: lessonsData } = trpcReact.curriculum.getLessons.useQuery({
    curriculumId: curriculum.id,
  });

  const totalLessons = lessonsData?.length ?? 0;
  const completedLessons =
    lessonsData?.filter((l) => l.progress?.status === "completed").length ?? 0;
  const progressPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const isGenerating = curriculum.generationStatus === "generating";
  const isFailed = curriculum.generationStatus === "failed";
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
      await deleteMutation.mutateAsync({ id: curriculum.id });
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
      const data = await retryMutation.mutateAsync({ id: curriculum.id });
      sessionStorage.setItem("bitebase_retry_profile", JSON.stringify(data));
      sessionStorage.setItem("bitebase_replace_curriculum_id", data.curriculumId);
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
      const data = await retryMutation.mutateAsync({ id: curriculum.id });
      sessionStorage.setItem("bitebase_retry_profile", JSON.stringify(data));
      sessionStorage.setItem("bitebase_replace_curriculum_id", data.curriculumId);
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
        aria-label={isDeleting ? "Deleting curriculum" : "Confirm delete"}
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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
          <BookOpen className="h-5 w-5 text-violet-600" />
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

      <h3 className="mb-1 font-semibold text-gray-900 line-clamp-2 group-hover:text-violet-700">
        {curriculum.title}
      </h3>
      <p className="mb-4 text-xs text-gray-500 line-clamp-2">
        {curriculum.description}
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
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-violet-600 py-1.5 text-xs font-medium text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
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
              {Math.round(curriculum.totalEstimatedMinutes / 60)}h total
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
                  className="flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-violet-200 hover:text-violet-600 transition-colors disabled:opacity-50"
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
            router.push(`/curriculum/${curriculum.id}`);
          }
        }}
        aria-label={`Open ${curriculum.title}`}
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
      onClick={() => router.push(`/curriculum/${curriculum.id}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`/curriculum/${curriculum.id}`);
        }
      }}
      aria-label={`Open ${curriculum.title}`}
      className="group block cursor-pointer rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-violet-200 hover:shadow-md"
    >
      {cardContent}
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
