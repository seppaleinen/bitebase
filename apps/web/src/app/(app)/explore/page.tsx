"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Clock,
  Loader2,
  Search,
  X,
  ChevronDown,
  Tag,
} from "lucide-react";
import { trpcReact } from "@/lib/trpc/provider";

function ExploreContent() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  const { data: categories } = trpcReact.public.listCategories.useQuery();
  const { data: curricula, isLoading } =
    trpcReact.public.listPublished.useQuery({
      category: selectedCategory ?? undefined,
      search: search.trim() || undefined,
    });

  const activeCategory =
    selectedCategory && categories
      ? categories.find((c) => c.category === selectedCategory)
      : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
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
          placeholder="Search curricula by title, description, or topic..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Trigger re-query via the search state change
            }
          }}
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-4 text-sm outline-none transition-all focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {/* Categories */}
      {categories && categories.length > 0 && (
        <div>
          {/* Mobile: dropdown */}
          <div className="sm:hidden">
            <button
              onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
              className="flex w-full items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700"
              aria-label="Select category"
            >
              <Tag className="h-4 w-4 text-gray-400" />
              <span className="flex-1 text-left">
                {activeCategory
                  ? activeCategory.category
                  : "All categories"}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-gray-400 transition-transform ${showCategoryDropdown ? "rotate-180" : ""}`}
              />
            </button>
            {showCategoryDropdown && (
              <div className="mt-1 rounded-xl border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => {
                    setSelectedCategory(null);
                    setShowCategoryDropdown(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm ${!selectedCategory ? "bg-accent-light font-medium text-accent-dark" : "text-gray-700 hover:bg-gray-50"}`}
                >
                  All categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.category}
                    onClick={() => {
                      setSelectedCategory(
                        cat.category === selectedCategory ? null : cat.category
                      );
                      setShowCategoryDropdown(false);
                    }}
                    className={`w-full px-4 py-2 text-left text-sm ${selectedCategory === cat.category ? "bg-accent-light font-medium text-accent-dark" : "text-gray-700 hover:bg-gray-50"}`}
                  >
                    {cat.category}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Desktop: pill buttons */}
          <div className="hidden sm:flex sm:flex-wrap sm:gap-2">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                !selectedCategory
                  ? "bg-accent text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.category}
                onClick={() =>
                  setSelectedCategory(
                    cat.category === selectedCategory ? null : cat.category
                  )
                }
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedCategory === cat.category
                    ? "bg-accent text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat.category}
                {cat.subcategories.length > 0 && (
                  <span className="ml-1 text-xs opacity-60">
                    ({cat.subcategories.length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active filters indicator */}
      {(selectedCategory || search.trim()) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
          <span>Filters:</span>
          {selectedCategory && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-dark">
              {selectedCategory}
              <button
                onClick={() => setSelectedCategory(null)}
                className="ml-0.5 hover:text-accent"
                aria-label={`Remove ${selectedCategory} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
          {search.trim() && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-dark">
              &ldquo;{search.trim()}&rdquo;
              <button
                onClick={() => setSearch("")}
                className="ml-0.5 hover:text-accent"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-accent/60" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!curricula || curricula.length === 0) && (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 py-20 text-center" style={{ backgroundColor: 'var(--color-bg-warm)' }}>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-light">
            <BookOpen className="h-8 w-8 text-accent" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            {search || selectedCategory
              ? "No matching curricula"
              : "No curricula yet"}
          </h3>
          <p className="text-sm text-gray-500">
            {search || selectedCategory
              ? "Try different filters or search terms."
              : "Be the first to create a curriculum and share it with the community."}
          </p>
        </div>
      )}

      {/* Curriculum grid */}
      {!isLoading && curricula && curricula.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {curricula.map((curriculum) => (
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
              className="group block cursor-pointer card card-hover p-5"
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light">
                  <BookOpen className="h-5 w-5 text-accent" />
                </div>
                {curriculum.category && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    {curriculum.category}
                    {curriculum.subcategory && ` · ${curriculum.subcategory}`}
                  </span>
                )}
              </div>
              <h3 className="mb-1 font-semibold text-gray-900 line-clamp-2 group-hover:text-accent-dark">
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
    </div>
  );
}

export default function ExplorePage() {
  return <ExploreContent />;
}
