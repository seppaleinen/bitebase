"use client";

import { use, useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Lock,
  CheckCircle,
  Circle,
  Clock,
  Loader2,
  BookOpen,
  ChevronRight,
  RotateCcw,
  Trash2,
  AlertTriangle,
  X,
  Tag,
  Pencil,
  Check,
} from "lucide-react";
import { trpcReact } from "@/lib/trpc/provider";
import { JsonLd } from "@/components/json-ld";
import { Progress, Badge } from "@bitebase/ui/web";
import type { CourseSection } from "@bitebase/db";

function useUser() {
  const { data, isLoading } = trpcReact.public.getSession.useQuery();
  return { user: data ?? null, isLoading };
}

/** Inline category editor for course owners. */
function CategoryEditor({
  courseId,
  currentCategory,
  currentSubcategory,
}: {
  courseId: string;
  currentCategory: string;
  currentSubcategory: string;
}) {
  const [editing, setEditing] = useState(false);
  const [category, setCategory] = useState(currentCategory);
  const [subcategory, setSubcategory] = useState(currentSubcategory);
  const inputRef = useRef<HTMLInputElement>(null);
  const utils = trpcReact.useUtils();

  const { data: categories } = trpcReact.public.listCategories.useQuery();
  const updateMutation = trpcReact.course.updateCategory.useMutation({
    onSuccess: () => {
      void utils.public.listPublished.invalidate();
      void utils.public.getPublishedCurriculum.invalidate({ id: courseId });
      void utils.public.listCategories.invalidate();
      setEditing(false);
    },
  });

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editing) {
    return (
      <button
        onClick={() => {
          setCategory(currentCategory);
          setSubcategory(currentSubcategory);
          setEditing(true);
        }}
        className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 text-xs text-white/80 hover:bg-white/30"
        aria-label="Edit category"
      >
        <Pencil className="h-3 w-3" />
        Edit
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Category"
        list="category-suggestions"
        className="w-32 rounded-lg border border-white/30 bg-white/20 px-2 py-1 text-xs text-white placeholder-white/50 outline-none focus:border-white/60"
        onKeyDown={(e) => {
          if (e.key === "Enter" && category.trim()) {
            updateMutation.mutate({
              courseId,
              category: category.trim(),
              subcategory: subcategory.trim() || undefined,
            });
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <input
        type="text"
        value={subcategory}
        onChange={(e) => setSubcategory(e.target.value)}
        placeholder="Subcategory"
        className="w-32 rounded-lg border border-white/30 bg-white/20 px-2 py-1 text-xs text-white placeholder-white/50 outline-none focus:border-white/60"
        onKeyDown={(e) => {
          if (e.key === "Enter" && category.trim()) {
            updateMutation.mutate({
              courseId,
              category: category.trim(),
              subcategory: subcategory.trim() || undefined,
            });
          }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button
        onClick={() => {
          if (category.trim()) {
            updateMutation.mutate({
              courseId,
              category: category.trim(),
              subcategory: subcategory.trim() || undefined,
            });
          }
        }}
        disabled={updateMutation.isPending || !category.trim()}
        className="inline-flex items-center gap-1 rounded-lg bg-white/20 px-2 py-1 text-xs text-white hover:bg-white/30 disabled:opacity-50"
        aria-label="Save category"
      >
        {updateMutation.isPending ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Check className="h-3 w-3" />
        )}
        Save
      </button>
      <button
        onClick={() => setEditing(false)}
        className="rounded-lg px-2 py-1 text-xs text-white/60 hover:text-white/80"
        aria-label="Cancel"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Datalist for category suggestions */}
      {categories && categories.length > 0 && (
        <datalist id="category-suggestions">
          {categories.map((cat) => (
            <option key={cat.category} value={cat.category} />
          ))}
        </datalist>
      )}
    </div>
  );
}

export default function CurriculumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useUser();
  const utils = trpcReact.useUtils();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: course, isLoading: loadingCurriculum } =
    trpcReact.public.getPublishedCurriculum.useQuery({ id });
  const { data: lessonsData, isLoading: loadingLessons } =
    trpcReact.public.getPublishedLessons.useQuery({ courseId: id });

  const { data: progressList } =
    trpcReact.course.getProgressForCourse.useQuery(
      { courseId: id },
      { enabled: !!user }
    );

  const deleteMutation = trpcReact.course.delete.useMutation({
    onSuccess: () => {
      void utils.course.list.invalidate();
      router.push(user ? "/dashboard" : "/explore");
    },
  });

  const retryMutation = trpcReact.course.retryAndGetProfile.useMutation({
    onSuccess: (result) => {
      // Store profile data for the onboarding flow, same as dashboard does
      if (typeof window !== "undefined") {
        const data = {
          topic: result.topic,
          experienceLevel: result.experienceLevel,
          goals: result.goals,
          additionalContext: result.additionalContext,
        };
        sessionStorage.setItem("bitebase_onboard_retry_profile", JSON.stringify(data));
        sessionStorage.setItem("bitebase_replace_course_id", result.courseId);
      }
      router.push("/onboarding");
    },
  });

  const isOwner = !!user && course?.userId === user.id;

  if (loadingCurriculum || loadingLessons) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!course || !lessonsData) return null;

  const sections = course.sections as CourseSection[];
  const totalLessons = lessonsData.length;
  const progressMap = new Map(
    (progressList ?? []).map((p) => [p.lessonId, p])
  );
  const completedLessons = lessonsData.filter(
    (l) => progressMap.get(l.id)?.status === "completed"
  ).length;
  const progressPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
    <main className="space-y-8">
      {/* Structured data for search engines + AI answer engines */}
      {course && (
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
                  name: course.title,
                },
              ],
            }}
          />
          <JsonLd
            data={{
              "@context": "https://schema.org",
              "@type": "Course",
              name: course.title,
              description: course.description,
              provider: {
                "@type": "Organization",
                name: "BiteBase",
                url: process.env.SITE_URL ?? "https://bitebase.labb.site",
              },
              numberOfLessons: lessonsData?.length ?? 0,
              timeRequired: `PT${Math.round(course.totalEstimatedMinutes)}M`,
              hasCourseInstance: {
                "@type": "CourseInstance",
                courseMode: "online",
                courseWorkload: `PT${Math.round(course.totalEstimatedMinutes)}M`,
              },
            }}
          />
        </>
      )}

      {/* Back + header */}
      <div>
        <Link
          href={user ? "/dashboard" : "/explore"}
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft className="h-4 w-4" />
          {user ? "Dashboard" : "Explore"}
        </Link>

        <div className="rounded-2xl bg-accent p-6 text-white">
          <div className="mb-1 flex items-center gap-2">
            <BookOpen className="h-5 w-5 opacity-80" />
            <span className="text-sm font-medium opacity-80">Curriculum</span>
          </div>
          <h1 className="mb-2 text-2xl font-bold">{course.title}</h1>
          <p className="text-sm opacity-80">{course.description}</p>

          {/* Category badge */}
          {course.category && (
            <div className="mb-4 mt-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium text-white">
                <Tag className="h-3 w-3" />
                {course.category}
                {course.subcategory && ` · ${course.subcategory}`}
              </span>
              {isOwner && (
                <CategoryEditor
                  courseId={course.id}
                  currentCategory={course.category ?? ""}
                  currentSubcategory={course.subcategory ?? ""}
                />
              )}
            </div>
          )}

          {user ? (
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
          ) : (
            <div className="text-sm opacity-70">
              {totalLessons} lessons — sign in to track progress
            </div>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {sections.map((section, sectionIdx) => {
          const sectionLessons = lessonsData.filter(
            (l) => l.sectionId === section.id
          );
          const sectionCompleted = sectionLessons.filter(
            (l) => progressMap.get(l.id)?.status === "completed"
          ).length;

          return (
            <div
              key={section.id}
              className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
            >
              <div className="flex items-center gap-4 border-b border-gray-50 bg-gray-50 px-5 py-4">
                <div
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white"
                  aria-label={`Section ${sectionIdx + 1}`}
                >
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
                  {section.subsections.map((sub: { id: string; title: string; description: string; order: number }) => {
                  const lesson = lessonsData.find(
                    (l) =>
                      l.sectionId === section.id &&
                      (l.subsectionId === sub.id || !l.subsectionId)
                  );
                  const lessonProgress = lesson
                    ? progressMap.get(lesson.id)
                    : undefined;
                  const lessonStatus =
                    lessonProgress?.status ?? (user ? "locked" : "available");
                  const isLocked = lessonStatus === "locked" || !lesson;
                  const isCompleted = lessonStatus === "completed";

                  return (
                    <div
                      key={sub.id}
                      className="flex items-center gap-4 px-5 py-4"
                    >
                      <div className="shrink-0">
                        {isCompleted ? (
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : isLocked ? (
                          <Lock className="h-5 w-5 text-gray-300" />
                        ) : (
                          <Circle className="h-5 w-5 text-accent" />
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
                          <Badge
                            variant="success"
                            className="text-xs font-bold"
                          >
                            Done
                          </Badge>
                        )}
                        {lessonStatus === "in_progress" && (
                          <Badge
                            variant="secondary"
                            className="text-xs font-bold"
                          >
                            In progress
                          </Badge>
                        )}
                        {lesson && !isLocked && (
                          <Link
                            href={`/lesson/${lesson.id}`}
                            className="flex items-center gap-1 rounded-lg bg-accent-subtle px-3 py-1.5 text-xs font-medium text-accent-dark hover:bg-accent-light"
                          >
                            {isCompleted ? "Review" : "Start"}
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        )}
                        {lesson && !user && (
                          <Link
                            href={`/lesson/${lesson.id}`}
                            className="flex items-center gap-1 rounded-lg bg-accent-subtle px-3 py-1.5 text-xs font-medium text-accent-dark hover:bg-accent-light"
                          >
                            Read
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

      {/* Owner controls */}
      {isOwner && (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-1 text-sm font-semibold text-gray-900">
            Manage course
          </h3>
          <p className="mb-4 text-xs text-gray-500">
            Only you can see these options as the creator.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => retryMutation.mutate({ id })}
              disabled={retryMutation.isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {retryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Remake course
            </button>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span className="text-sm text-red-700">Delete forever?</span>
                <button
                  onClick={() => deleteMutation.mutate({ id })}
                  disabled={deleteMutation.isPending}
                  className="rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Confirm"
                  )}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
    </div>
  );
}
