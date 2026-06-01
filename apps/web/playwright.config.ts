import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Start an isolated Next.js dev server on port 3001 so E2E tests don't
  // interfere with a dev server already running on port 3000.
  // Override with PLAYWRIGHT_BASE_URL to use an existing server.
  webServer: process.env.SKIP_WEB_SERVER
    ? undefined
    : {
        command: "pnpm --filter @bitebase/web dev --port 3001",
        url: "http://localhost:3001",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
