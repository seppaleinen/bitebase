import type { MetadataRoute } from "next";
import { db } from "@bitebase/db";
import { courses } from "@bitebase/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

function toSlug(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\s&]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.SITE_URL ?? "https://bitebase.labb.site";

  const entries: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
  ];

  // Add category pages
  try {
    const rows = await db
      .select({ category: courses.category })
      .from(courses)
      .where(eq(courses.isPublished, true))
      .groupBy(courses.category)
      .orderBy(courses.category);

    for (const row of rows) {
      if (row.category) {
        entries.push({
          url: `${baseUrl}/category/${encodeURIComponent(toSlug(row.category))}`,
          lastModified: new Date(),
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // DB not available during build — serve static entries only
  }

  // Add /learn/[slug] pages for every published course
  try {
    const courseRows = await db
      .select({ slug: courses.slug })
      .from(courses)
      .where(eq(courses.isPublished, true))
      .orderBy(courses.slug);

    for (const row of courseRows) {
      entries.push({
        url: `${baseUrl}/learn/${encodeURIComponent(row.slug)}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // DB not available during build — serve static entries only
  }

  return entries;
}
