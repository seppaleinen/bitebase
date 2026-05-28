import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@bitebase/ui", "@bitebase/api", "@bitebase/db", "@bitebase/ai"],
};

export default nextConfig;
