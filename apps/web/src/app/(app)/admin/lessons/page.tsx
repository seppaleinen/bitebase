"use client";

import { useState, useCallback } from "react";
import { Loader2, RefreshCw, BookOpen, CheckCircle, AlertCircle, Hash, Layers } from "lucide-react";
import { trpcReact } from "@/lib/trpc/provider";

// ── Lightweight inline toast ──────────────────────────────────────────────────

type Toast = { id: number; message: string; type: "success" | "error" };
let nextToastId = 0;

function ToastBar({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg px-4 py-3 shadow-lg transition-all ${
        toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
      }`}
      role="status"
      aria-live="polite"
    >
      {toast.type === "success" ? <CheckCircle className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-2 rounded p-0.5 hover:bg-white/20"
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
}

// ── Version badge helper ──────────────────────────────────────────────────────

function VersionBadge({ version, count }: { version: number; count: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-subtle px-2.5 py-0.5 text-xs font-medium text-accent-dark">
      <Hash className="h-3 w-3" />
      v{version} × {count}
    </span>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminCurriculaPage() {
  const { data, isLoading, refetch } = trpcReact.admin.listCurricula.useQuery();
  const regenerateCurrMut = trpcReact.admin.regenerateCurriculum.useMutation({
    onSuccess: (res) => {
      const total = res.lessonResults.length;
      const bumped = res.lessonResults.filter((r) => r.newVersion > 0).length;
      addToast(
        `Regenerated ${total} lesson(s) in course (${bumped} version bump${bumped !== 1 ? "s" : ""})`,
        "success"
      );
      void refetch();
    },
    onError: (err) => {
      addToast(err.message || "Regenerate failed", "error");
    },
  });
  const regenerageVersionMut = trpcReact.admin.regenerateLessonsByVersion.useMutation({
    onSuccess: (results) => {
      addToast(`Regenerated ${results.length} lesson(s) by version`, "success");
      void refetch();
    },
    onError: (err) => {
      addToast(err.message || "Version regenerate failed", "error");
    },
  });

  const [regeneratingCurrId, setRegeneratingCurrId] = useState<string | null>(null);
  const [regeneratingVersion, setRegeneratingVersion] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, [setToasts]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, [setToasts]);

  const handleRegenerateCurriculum = async (courseId: string) => {
    setRegeneratingCurrId(courseId);
    try {
      await regenerateCurrMut.mutateAsync({ courseId });
    } catch {
      // errors handled by onError
    } finally {
      setRegeneratingCurrId(null);
    }
  };

  const handleRegenerateVersion = async (version: number) => {
    setRegeneratingVersion(version);
    try {
      await regenerageVersionMut.mutateAsync({ version });
    } catch {
      // errors handled by onError
    } finally {
      setRegeneratingVersion(null);
    }
  };

  const courses = data?.courses ?? [];
  const versionRollup = data?.versionRollup ?? [];

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Admin – Curricula</h1>

      {/* ── Toasts ────────────────────────────────────────────────────── */}
      {toasts.map((t) => (
        <ToastBar key={t.id} toast={t} onDismiss={dismissToast} />
      ))}

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      )}

      {/* ── Version rollup cards ──────────────────────────────────────── */}
      {!isLoading && versionRollup.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-accent" />
            Group by version
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {versionRollup.map((v) => (
              <div
                key={v.version}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-lg font-bold text-gray-900">Version {v.version}</span>
                  <span className="text-sm text-gray-500">
                    {v.totalLessons} lesson{v.totalLessons !== 1 ? "s" : ""} across {v.coursesCount} course / courses
                  </span>
                </div>
                <button
                  onClick={() => handleRegenerateVersion(v.version)}
                  disabled={regeneratingVersion === v.version}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
                >
                  {regeneratingVersion === v.version ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Regenerating…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Regenerate all v{v.version}
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Curriculum list ────────────────────────────────────────────── */}
      {!isLoading && courses.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-accent" />
            Group by course
          </h2>
          <div className="space-y-4">
            {courses.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-semibold text-gray-900">{c.title}</h3>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-4 w-4" />
                        {c.totalLessons} lesson{c.totalLessons !== 1 ? "s" : ""}
                      </span>
                      <span className="text-xs text-gray-400">
                        Created {new Date(c.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {/* Version badges */}
                    {c.versionSummary.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {c.versionSummary.map((v) => (
                          <VersionBadge key={v.version} version={v.version} count={v.count} />
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => handleRegenerateCurriculum(c.id)}
                    disabled={regeneratingCurrId === c.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
                    title="Regenerate all lessons in this course"
                  >
                    {regeneratingCurrId === c.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Regenerating…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4" />
                        Regenerate
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!isLoading && courses.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-16 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-lg font-medium text-gray-700">No courses found</p>
          <p className="mt-1 max-w-md text-sm text-gray-500">
            Curricula will appear here once they have been created.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
