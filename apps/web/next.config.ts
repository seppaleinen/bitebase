import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bitebase/ui", "@bitebase/api", "@bitebase/db", "@bitebase/ai"],
  // Produces a self-contained build for Docker / Kubernetes.
  // The standalone output copies only the necessary files into .next/standalone,
  // which is then the only thing the container needs at runtime.
  output: "standalone",
  // Disable the dev indicator button so it doesn't interfere with Playwright
  // selectors that match button names containing "Next".
  devIndicators: false,

  // Security headers applied to all routes
  async headers() {
    // In dev mode, Next.js needs 'unsafe-inline' and 'unsafe-eval' for HMR,
    // React Refresh, and source maps (eval-source-map). In production the
    // bundled scripts are loaded from same-origin static files, so 'self' is
    // sufficient. We cannot use strict CSP in dev without breaking hydration.
    const isDev = process.env.NODE_ENV === "development";
    const scriptSrc = isDev
      ? "'self' 'unsafe-inline' 'unsafe-eval'"
      : "'self'";

    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // Allow loading fonts from self (self-hosted) and Google Fonts CDN fallback
              "font-src 'self' https://fonts.gstatic.com",
              // Allow loading styles from self and inline styles (Next.js injects inline styles)
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Allow loading images from self, data: URIs, and external sources (lesson images)
              "img-src 'self' data: https: http:",
              // Allow connecting to self, Ollama API, and WebSocket for HMR in dev
              "connect-src 'self' http://localhost:* ws://localhost:*",
              // Scripts: permissive in dev for HMR, strict in production
              `script-src ${scriptSrc}`,
              // Allow manifest and workers
              "manifest-src 'self'",
              // Block all frames
              "frame-src 'none'",
              // Block all object/embed
              "object-src 'none'",
              // Restrict base URIs
              "base-uri 'self'",
              // Restrict form actions
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
