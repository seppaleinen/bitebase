import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpen, Clock, Home, ChevronRight } from "lucide-react";
import { db } from "@bitebase/db";
import { courses } from "@bitebase/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { JsonLd } from "@/components/json-ld";

// ── Slug helpers ─────────────────────────────────────────────────────────

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\s&]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Page ─────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Get all categories from DB
  const rows = await db
    .select({ category: courses.category })
    .from(courses)
    .where(eq(courses.isPublished, true))
    .groupBy(courses.category)
    .orderBy(courses.category);

  const categories = rows
    .map((r) => r.category)
    .filter((c): c is string => c !== null);

  // Build slug → category map
  const slugMap = new Map<string, string>();
  for (const cat of categories) {
    slugMap.set(toSlug(cat), cat);
  }

  const categoryName = slugMap.get(slug);

  // 404 if no matching category
  if (!categoryName) {
    // Try reverse: maybe the slug IS the category name (e.g., slug="Tech")
    const directMatch = categories.find(
      (c) => c.toLowerCase() === slug.toLowerCase()
    );
    if (!directMatch) {
      notFound();
    }
    // Use direct match
    const coursesList = await getCoursesForCategory(directMatch);
    return renderPage(slug, directMatch, coursesList);
  }

  const coursesList = await getCoursesForCategory(categoryName);
  return renderPage(slug, categoryName, coursesList);
}

// ── Data fetching ─────────────────────────────────────────────────────────

async function getCoursesForCategory(category: string) {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      category: courses.category,
      subcategory: courses.subcategory,
      totalEstimatedMinutes: courses.totalEstimatedMinutes,
      createdAt: courses.createdAt,
    })
    .from(courses)
    .where(and(eq(courses.isPublished, true), eq(courses.category, category)))
    .orderBy(desc(courses.createdAt))
    .limit(50);
}

// ── Render ────────────────────────────────────────────────────────────────

async function renderPage(
  slug: string,
  categoryName: string,
  coursesList: Awaited<ReturnType<typeof getCoursesForCategory>>
) {
  const baseUrl = process.env.SITE_URL ?? "https://bitebase.labb.site";
  const pageDescription = `Explore BiteBase's ${categoryName} courses. Learn ${categoryName} with personalized AI-generated lessons and quizzes.`;

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      {/* Structured data */}
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: baseUrl,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Explore",
              item: `${baseUrl}/explore`,
            },
            {
              "@type": "ListItem",
              position: 3,
              name: categoryName,
            },
          ],
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${categoryName} Courses`,
          description: pageDescription,
          url: `${baseUrl}/category/${slug}`,
          numberOfItems: coursesList.length,
          itemListElement: coursesList.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Course",
              name: c.title,
              description: c.description,
              url: `${baseUrl}/course/${c.id}`,
            },
          })),
        }}
      />

      {/* Breadcrumb nav */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-gray-500">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-gray-700 transition-colors">
          <Home className="h-3.5 w-3.5" />
          Home
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/explore" className="hover:text-gray-700 transition-colors">
          Explore
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-gray-900 font-medium">{categoryName}</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 font-[family-name:var(--font-fraunces)]">
          {categoryName} Courses
        </h1>
        <p className="mt-2 text-gray-500">
          {pageDescription}
        </p>
      </div>

      {/* Curriculum grid */}
      {coursesList.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white py-20 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-subtle">
            <BookOpen className="h-8 w-8 text-accent" />
          </div>
          <h2 className="mb-2 text-lg font-semibold text-gray-900">
            No {categoryName} courses yet
          </h2>
          <p className="text-sm text-gray-500">
            Be the first to create a course in this category.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {coursesList.map((c) => (
            <Link
              key={c.id}
              href={`/course/${c.id}`}
              className="group block rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-accent-light hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-subtle">
                  <BookOpen className="h-5 w-5 text-accent" />
                </div>
                {c.subcategory && (
                  <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                    {c.subcategory}
                  </span>
                )}
              </div>
              <h2 className="mb-1 font-semibold text-gray-900 line-clamp-2 group-hover:text-accent-dark">
                {c.title}
              </h2>
              <p className="mb-4 text-xs text-gray-500 line-clamp-2">
                {c.description}
              </p>
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {Math.round(c.totalEstimatedMinutes / 60)}h total
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
