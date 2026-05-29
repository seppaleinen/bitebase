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
};

export default nextConfig;
