"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, RefreshCw, Layers, CheckCircle, AlertCircle } from "lucide-react";
import { trpcReact } from "@/lib/trpc/provider";

// ── Lightweight inline toast ──────────────────────────────────────────────────

type Toast = { id: number; message: string; type: "success" | "error" };
let nextToastId = 0;

function ToastBar({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminLessonPage() {
  const { data, isLoading, refetch } = trpcReact.admin.listLessonVersions.useQuery();
  const regenerateMut = trpcReact.admin.regenerateLesson.useMutation({
    onSuccess: (res) => {
      addToast(`Lesson ${res.lessonId.slice(0, 8)}… → v${res.newVersion}`, "success");
      void refetch();
    },
    onError: (err) => {
      addToast(err.message || "Regenerate failed", "error");
    },
  });
  const bulkMut = trpcReact.admin.regenerateLessonsByVersion.useMutation({
    onSuccess: (results) => {
      addToast(`Regenerated ${results.length} lesson(s) successfully`, "success");
      void refetch();
    },
    onError: (err) => {
      addToast(err.message || "Bulk regenerate failed", "error");
    },
  });

  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [regeneratingVersion, setRegeneratingVersion] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: "success" | "error") => {
    const id = nextToastId++;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, [setToasts]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, [setToasts]);

  const handleRegenerate = async (lessonId: string) => {
    setRegeneratingId(lessonId);
    try {
      await regenerateMut.mutateAsync({ lessonId });
    } catch {
      // errors handled by onError
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleBulkRegenerate = async (version: number) => {
    setRegeneratingVersion(version);
    try {
      await bulkMut.mutateAsync({ version });
    } catch {
      // errors handled by onError
    } finally {
      setRegeneratingVersion(null);
    }
  };

  // ── Derive rollup from data ─────────────────────────────────────────────
  const rollup = data?.rollup ?? [];
  const detail = data?.detail ?? [];

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Admin – Lesson Versions</h1>

      {/* ── Toasts ────────────────────────────────────────────────────── */}
      {toasts.map((t) => (
        <ToastBar key={t.id} toast={t} onDismiss={dismissToast} />
      ))}

      {/* ── Loading ───────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      )}

      {/* ── Version rollup cards ──────────────────────────────────────── */}
      {!isLoading && rollup.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Layers className="h-5 w-5 text-violet-500" />
            Versions at a glance
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rollup.map((v) => (
              <div
                key={v.version}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-lg font-bold text-gray-900">Version {v.version}</span>
                  <span className="text-sm text-gray-500">
                    {v.totalLessons} lesson{v.totalLessons !== 1 ? "s" : ""} ({v.totalRows} row{v.totalRows !== 1 ? "s" : ""})
                  </span>
                </div>
                <button
                  onClick={() => handleBulkRegenerate(v.version)}
                  disabled={regeneratingVersion === v.version}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
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

      {/* ── Detailed per-lesson table ──────────────────────────────────── */}
      {!isLoading && detail.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-800">Per-lesson detail</h2>
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full table-auto">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Lesson ID
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Lesson version
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Prompt version
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Rows
                  </th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {detail.map((row) => (
                  <tr key={`${row.lessonId}-${row.version}-${row.promptVersion ?? "null"}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-800">{row.lessonId}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-800">{row.version}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{row.promptVersion ?? "—"}</td>
                    <td className="px-4 py-2.5 text-sm text-gray-600">{row.count}</td>
                    <td className="px-4 py-2.5">
                      <button
                        onClick={() => handleRegenerate(row.lessonId)}
                        disabled={regeneratingId === row.lessonId}
                        className="flex items-center gap-1 rounded bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                        title="Regenerate this lesson"
                      >
                        {regeneratingId === row.lessonId ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        Regenerate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {!isLoading && detail.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-16 text-center">
          <Layers className="mb-3 h-10 w-10 text-gray-300" />
          <p className="text-lg font-medium text-gray-700">No lesson version data found</p>
          <p className="mt-1 max-w-md text-sm text-gray-500">
            Lessons will appear here once they have been generated. If you expect to see data, try refreshing.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 flex items-center gap-1.5 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}
