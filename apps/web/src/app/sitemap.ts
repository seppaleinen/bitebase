import type { MetadataRoute } from "next";
import { db } from "@bitebase/db";
import { curricula } from "@bitebase/db/schema";
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
      .select({ category: curricula.category })
      .from(curricula)
      .where(eq(curricula.isPublished, true))
      .groupBy(curricula.category)
      .orderBy(curricula.category);

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

  return entries;
}
