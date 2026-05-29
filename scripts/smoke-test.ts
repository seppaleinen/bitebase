/**
 * Exploratory smoke test — runs against the live dev server (http://localhost:3000)
 * using a real browser session. Tests the onboarding chat flow end-to-end with
 * the actual Ollama model. Takes screenshots at each step.
 *
 * Run with:
 *   npx tsx scripts/smoke-test.ts
 */

import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "http://localhost:3000";
const SCREENSHOTS_DIR = path.join(import.meta.dirname, "smoke-screenshots");

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

let step = 0;
async function shot(page: import("playwright").Page, label: string) {
  step++;
  const file = path.join(SCREENSHOTS_DIR, `${String(step).padStart(2, "0")}-${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  📸 ${label} → ${path.relative(process.cwd(), file)}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  // ── 1. Landing page ─────────────────────────────────────────────────────────
  console.log("\n[1] Landing page");
  await page.goto(BASE_URL);
  await page.waitForLoadState("networkidle");
  const heading = await page.getByRole("heading").first().textContent();
  console.log(`    Heading: "${heading}"`);
  await shot(page, "landing");

  // ── 2. Register page ─────────────────────────────────────────────────────────
  console.log("\n[2] Register page");
  await page.goto(`${BASE_URL}/register`);
  await page.waitForLoadState("networkidle");
  await shot(page, "register");

  // ── 3. Login page ─────────────────────────────────────────────────────────────
  console.log("\n[3] Login page");
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState("networkidle");
  await shot(page, "login");

  // ── 4. Dashboard (via test-bypass cookie) ────────────────────────────────────
  console.log("\n[4] Dashboard (test session bypass)");
  await page.goto(BASE_URL);
  await page.context().addCookies([
    { name: "__playwright_test__", value: "1", domain: "localhost", path: "/" },
  ]);
  await page.goto(`${BASE_URL}/dashboard`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2000); // let tRPC query settle
  await shot(page, "dashboard");
  const dashText = await page.locator("h1, h2, h3").first().textContent();
  console.log(`    First heading: "${dashText}"`);

  // ── 5. Onboarding chat (bypass gate via ?prompt= param) ──────────────────────
  // Navigate directly into the chat with a pre-filled prompt so we skip the
  // GateOrChat tRPC call (which fails without a real session).
  console.log("\n[5] Onboarding chat — navigating with ?prompt=");
  await page.goto(`${BASE_URL}/onboarding?prompt=${encodeURIComponent("I want to learn philosophy")}`);
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1000);
  await shot(page, "onboarding-loaded");

  const inputVisible = await page.getByPlaceholder(/type your message/i).isVisible().catch(() => false);
  console.log(`    Chat input visible: ${inputVisible}`);

  // ── 6. Wait for Ollama to respond (prompt auto-sends via useEffect) ──────────
  console.log("\n[6] Waiting for Ollama response (auto-sent, up to 90s)...");
  const startTime = Date.now();

  // The page starts with 2 messages already (hardcoded initial AI + auto-sent user message).
  // Wait for a 3rd message (Ollama's actual response) OR the generation overlay to appear.
  // Use page.waitForTimeout in a loop instead of waitForFunction to avoid Playwright's
  // 30s default page timeout clamping our explicit timeout.
  let responded = false;
  for (let i = 0; i < 18 && !responded; i++) {
    await page.waitForTimeout(5_000);
    responded = await page.evaluate(() => {
      if (document.querySelector(".animate-ping")) return true;
      const bouncing = document.querySelector(".animate-bounce");
      const msgs = document.querySelectorAll(".whitespace-pre-wrap");
      return !bouncing && msgs.length >= 3;
    }).catch(() => false);
  }
  if (!responded) console.log("    ⚠️  90s elapsed without detecting response — screenshotting anyway");

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`    Ollama responded / generation started in ${elapsed}s`);
  await shot(page, "onboarding-ai-response");

  const allText = await page.locator(".whitespace-pre-wrap").allTextContents();
  for (const m of allText) {
    if (m.trim()) console.log(`    💬 "${m.trim().slice(0, 120)}"`);
  }

  const generationOverlay = await page.getByText(/building your curriculum/i).isVisible().catch(() => false);
  console.log(`    Generation overlay visible: ${generationOverlay}`);

  const errorVisible = await page.getByText(/error|something went wrong/i).isVisible().catch(() => false);
  if (errorVisible) {
    console.log("    ❌ Error message on page!");
    await shot(page, "onboarding-error");
  }

  // ── 7. Summary ───────────────────────────────────────────────────────────────
  console.log("\n✅ Smoke test complete. Screenshots saved to:", SCREENSHOTS_DIR);

  await browser.close();
}

main().catch((err) => {
  console.error("\n❌ Smoke test failed:", err);
  process.exit(1);
});
