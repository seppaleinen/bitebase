"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { trpcReact } from "@/lib/trpc/provider";

export default function AdminLessonPage() {
  const { data, isLoading, refetch } = trpcReact.admin.listLessonVersions.useQuery();
  const regenerateMut = trpcReact.admin.regenerateLesson.useMutation({
    onSuccess: () => {
      // Refresh the list to show new version counts
      void refetch();
    },
  });

  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const handleRegenerate = async (lessonId: string) => {
    setRegeneratingId(lessonId);
    try {
      await regenerateMut.mutateAsync({ lessonId });
    } catch (e) {
      console.error(e);
      // could add toast notification
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Admin – Lesson Versions</h1>

      {isLoading && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
        </div>
      )}

      {data && data.length > 0 && (
        <table className="min-w-full table-auto border border-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Lesson ID</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Version</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Count</th>
              <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={`${row.lessonId}-${row.version}`} className="border-t border-gray-200">
                <td className="px-4 py-2 text-sm text-gray-800">{row.lessonId}</td>
                <td className="px-4 py-2 text-sm text-gray-800">{row.version}</td>
                <td className="px-4 py-2 text-sm text-gray-800">{row.count}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => handleRegenerate(row.lessonId)}
                    disabled={regeneratingId === row.lessonId}
                    className="flex items-center gap-1 rounded bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                  >
                    {regeneratingId === row.lessonId ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Regenerate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {data && data.length === 0 && !isLoading && (
        <p className="text-gray-600">No lesson version data found.</p>
      )}
    </div>
  );
}
