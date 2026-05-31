"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Clock,
  Loader2,
  Search,
} from "lucide-react";
import { trpcReact } from "@/lib/trpc/provider";

function ExploreContent() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const { data: curricula, isLoading } =
    trpcReact.public.listPublished.useQuery();

  const filtered = curricula
    ? search.trim()
      ? curricula.filter(
          (c) =>
            c.title.toLowerCase().includes(search.toLowerCase()) ||
            c.description.toLowerCase().includes(search.toLowerCase())
        )
      : curricula
    : [];

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Explore curricula</h1>
        <p className="mt-1 text-sm text-gray-500">
          Browse community-generated courses. Find something new to learn.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search curricula..."
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        />
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
            <BookOpen className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            {search ? "No matching curricula" : "No curricula yet"}
          </h3>
          <p className="text-sm text-gray-500">
            {search
              ? "Try a different search term."
              : "Be the first to create a curriculum and share it with the community."}
          </p>
        </div>
      )}

      {/* Curriculum grid */}
      {filtered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((curriculum) => (
            <div
              key={curriculum.id}
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
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100">
                  <BookOpen className="h-5 w-5 text-violet-600" />
                </div>
              </div>
              <h3 className="mb-1 font-semibold text-gray-900 line-clamp-2 group-hover:text-violet-700">
                {curriculum.title}
              </h3>
              <p className="mb-4 text-xs text-gray-500 line-clamp-2">
                {curriculum.description}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.round(curriculum.totalEstimatedMinutes / 60)}h total
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return <ExploreContent />;
}
