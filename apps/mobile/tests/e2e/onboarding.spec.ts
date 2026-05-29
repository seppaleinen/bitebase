import { test, expect } from "./fixtures";
import { mockAI, mockGenerate } from "./fixtures";
import type { Page } from "@playwright/test";

async function sendMessage(page: Page, text: string) {
  const textarea = page.getByPlaceholder("Type your message...");
  await textarea.click();
  await textarea.type(text);
  const sendBtn = page.getByRole("button", { name: /send message/i });
  await expect(sendBtn).toBeEnabled({ timeout: 10000 });
  await sendBtn.click();
}

test.describe("Mobile onboarding", () => {
  test("loads with welcome message and text input", async ({ page }) => {
    await mockAI(page, "greeting");

    await page.goto("/onboarding");

    await expect(
      page.getByText(/I'm BiteBase/).first(),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("Type your message..."),
    ).toBeVisible();
  });

  test("shows level suggestion chips when AI asks about experience", async ({
    page,
  }) => {
    await mockAI(page, "level");

    await page.goto("/onboarding");

    await sendMessage(page, "Italian");

    await expect(
      page.getByRole("button", { name: "Beginner" }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByRole("button", { name: "Intermediate" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Advanced" }),
    ).toBeVisible();
  });

  test("tapping a suggestion chip sends that message", async ({ page }) => {
    await mockAI(page, "level");

    await page.goto("/onboarding");

    await sendMessage(page, "Italian");

    await expect(
      page.getByRole("button", { name: "Intermediate" }),
    ).toBeVisible({ timeout: 10000 });
    await page.getByRole("button", { name: "Intermediate" }).click();

    await expect(page.getByText("Intermediate").first()).toBeVisible();
  });

  test("shows No preference chip for or-questions", async ({ page }) => {
    await mockAI(page, "or-question");

    await page.goto("/onboarding");

    await sendMessage(page, "Italian");

    await expect(
      page.getByRole("button", { name: "No preference" }),
    ).toBeVisible({ timeout: 10000 });
  });

  test("shows confirmation card after all fields collected", async ({
    page,
  }) => {
    await mockAI(page, "simple-ack");
    await mockGenerate(page);

    await page.goto("/onboarding");

    await sendMessage(page, "I want to learn Italian");
    await page.waitForTimeout(800);

    await sendMessage(page, "Intermediate");
    await page.waitForTimeout(800);

    await sendMessage(page, "Hold conversations");

    // Wait for heuristic to detect all fields → confirmation card
    await expect(
      page.getByText("Ready to generate your curriculum"),
    ).toBeVisible({ timeout: 15000 });

    // Profile details shown in card
    await expect(page.getByText("Italian").first()).toBeVisible();
    await expect(page.getByText("Intermediate").first()).toBeVisible();
    await expect(page.getByText("Hold conversations").first()).toBeVisible();

    // Action buttons visible
    await expect(
      page.getByRole("button", { name: /edit answers/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /build my curriculum/i }),
    ).toBeVisible();
  });
});
