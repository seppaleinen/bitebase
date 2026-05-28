"use client";

import { use } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Lock,
  CheckCircle,
  Circle,
  Clock,
  Loader2,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { trpcReact } from "@/lib/trpc/provider";
import { Progress, Badge } from "@bitebase/ui/web";
import type { CurriculumSection } from "@bitebase/db";

export default function CurriculumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: curriculum, isLoading: loadingCurriculum } =
    trpcReact.curriculum.get.useQuery({ id });
  const { data: lessonsData, isLoading: loadingLessons } =
    trpcReact.curriculum.getLessons.useQuery({ curriculumId: id });

  if (loadingCurriculum || loadingLessons) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  if (!curriculum || !lessonsData) return null;

  const sections = curriculum.sections as CurriculumSection[];
  const totalLessons = lessonsData.length;
  const completedLessons = lessonsData.filter(
    (l) => l.progress?.status === "completed"
  ).length;
  const progressPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const lessonsBySectionAndSubsection = new Map(
    lessonsData.map((l) => [`${l.sectionId}:${l.subsectionId ?? ""}`, l])
  );
  const lessonBySection = new Map(lessonsData.map((l) => [l.sectionId + (l.subsectionId ?? ""), l]));

  return (
    <div className="space-y-8">
      {/* Back + header */}
      <div>
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>

        <div className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-6 text-white">
          <div className="mb-1 flex items-center gap-2">
            <BookOpen className="h-5 w-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">Curriculum</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold">{curriculum.title}</h1>
          <p className="mb-4 text-sm opacity-80">{curriculum.description}</p>

          <div className="flex items-center gap-6">
            <div className="text-sm">
              <span className="font-semibold">{completedLessons}</span>
              <span className="opacity-70">/{totalLessons} lessons done</span>
            </div>
            <div className="flex-1">
              <Progress
                value={progressPct}
                className="h-1.5 bg-white/30"
              />
            </div>
            <span className="text-sm font-semibold">{progressPct}%</span>
          </div>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, sectionIdx) => {
          const sectionLessons = lessonsData.filter(
            (l) => l.sectionId === section.id
          );
          const sectionCompleted = sectionLessons.filter(
            (l) => l.progress?.status === "completed"
          ).length;

          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              <div className="flex items-center gap-4 border-b border-gray-50 bg-gray-50 px-5 py-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-bold text-white">
                  {sectionIdx + 1}
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-gray-900">
                    {section.title}
                  </h2>
                  <p className="text-xs text-gray-500">{section.description}</p>
                </div>
                <div className="text-right text-xs text-gray-400">
                  <div className="font-medium text-gray-600">
                    {sectionCompleted}/{sectionLessons.length}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {section.estimatedMinutes}m
                  </div>
                </div>
              </div>

              <div className="divide-y divide-gray-50">
                {section.subsections.map((sub) => {
                  const lesson = lessonsBySectionAndSubsection.get(
                    `${section.id}:${sub.id}`
                  ) ?? lessonBySection.get(section.id + sub.id);
                  const lessonStatus = lesson?.progress?.status ?? "locked";
                  const isLocked = lessonStatus === "locked" || !lesson;
                  const isCompleted = lessonStatus === "completed";
                  const isAvailable =
                    lessonStatus === "available" ||
                    lessonStatus === "in_progress";

                  return (
                    <div key={sub.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="shrink-0">
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : isLocked ? (
                          <Lock className="h-5 w-5 text-gray-300" />
                        ) : (
                          <Circle className="h-5 w-5 text-violet-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p
                          className={`text-sm font-medium ${
                            isLocked ? "text-gray-400" : "text-gray-900"
                          }`}
                        >
                          {sub.title}
                        </p>
                        <p className="text-xs text-gray-400">
                          {sub.description}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isCompleted && (
                          <Badge variant="success" className="text-xs">
                            Done
                          </Badge>
                        )}
                        {lessonStatus === "in_progress" && (
                          <Badge variant="secondary" className="text-xs">
                            In progress
                          </Badge>
                        )}
                        {lesson && !isLocked && (
                          <Link
                            href={`/lesson/${lesson.id}`}
                            className="flex items-center gap-1 rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100"
                          >
                            {isCompleted ? "Review" : "Start"}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
