import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.SITE_URL ?? "https://bitebase.labb.site";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/dashboard", "/onboarding", "/admin", "/lesson/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
