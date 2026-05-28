"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BookOpen,
  Clock,
  Trophy,
  Plus,
  ChevronRight,
  Loader2,
  Sparkles,
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
    <div className="space-y-8">
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
        <Link
          href="/onboarding"
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
        >
          <Plus className="h-4 w-4" />
          New course
        </Link>
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
    </div>
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
  const { data: lessonsData } = trpcReact.curriculum.getLessons.useQuery({
    curriculumId: curriculum.id,
  });

  const totalLessons = lessonsData?.length ?? 0;
  const completedLessons =
    lessonsData?.filter((l) => l.progress?.status === "completed").length ?? 0;
  const progressPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const isGenerating = curriculum.generationStatus !== "complete";

  return (
    <Link
      href={`/curriculum/${curriculum.id}`}
      className="group block rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-violet-200 hover:shadow-md"
    >
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
          <BookOpen className="h-5 w-5 text-violet-600" />
        </div>
        {isGenerating && (
          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating
          </span>
        )}
        {!isGenerating && progressPct === 100 && (
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
        <Progress value={progressPct} />
      </div>

      <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {Math.round(curriculum.totalEstimatedMinutes / 60)}h total
        </span>
        <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
