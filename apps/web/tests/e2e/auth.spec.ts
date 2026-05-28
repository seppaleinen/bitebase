import { test, expect, mockAuth } from "./fixtures";

test.describe("Auth — Registration", () => {
  test("register page renders the sign-up form", async ({ page }) => {
    await page.goto("/register");

    await expect(page.getByRole("heading", { name: /start learning/i })).toBeVisible();
    await expect(page.getByPlaceholder(/alex johnson/i)).toBeVisible();
    await expect(page.getByPlaceholder(/you@example\.com/i)).toBeVisible();
    await expect(page.getByPlaceholder(/min\. 8 characters/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /create account/i })
    ).toBeVisible();
  });

  test("successful registration redirects to /onboarding", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/register");

    await page.getByPlaceholder(/alex johnson/i).fill("Test User");
    await page.getByPlaceholder(/you@example\.com/i).fill("test@bitebase.dev");
    await page.getByPlaceholder(/min\. 8 characters/i).fill("password123");
    await page.getByRole("button", { name: /create account/i }).click();

    await expect(page).toHaveURL(/\/onboarding/);
  });

  test("sign-in link on register page navigates to /login", async ({ page }) => {
    await page.goto("/register");
    await page.getByRole("link", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Auth — Login", () => {
  test("login page renders the sign-in form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    await expect(page.getByPlaceholder(/you@example\.com/i)).toBeVisible();
    await expect(page.getByPlaceholder(/••••••••/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /sign in/i })
    ).toBeVisible();
  });

  test("successful login redirects to /dashboard", async ({ page }) => {
    await mockAuth(page);
    await page.goto("/login");

    await page.getByPlaceholder(/you@example\.com/i).fill("test@bitebase.dev");
    await page.getByPlaceholder(/••••••••/).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("failed login shows an error message", async ({ page }) => {
    await mockAuth(page, { fail: true });
    await page.goto("/login");

    await page.getByPlaceholder(/you@example\.com/i).fill("wrong@example.com");
    await page.getByPlaceholder(/••••••••/).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Error message should appear — we don't care about exact wording
    const errorEl = page.locator(".bg-red-50");
    await expect(errorEl).toBeVisible();
  });

  test("register link on login page navigates to /register", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: /create one free/i }).click();
    await expect(page).toHaveURL(/\/register/);
  });

  test("password visibility toggle works", async ({ page }) => {
    await page.goto("/login");
    const passwordInput = page.getByPlaceholder(/••••••••/);
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click the eye icon button
    await page.locator("button[type='button']").first().click();
    await expect(passwordInput).toHaveAttribute("type", "text");
  });
});

test.describe("Auth — Landing page", () => {
  test("landing page renders with sign-in and register CTAs", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /learn anything/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /get started free/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
  });

  test("get started CTA links to /register", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /get started free/i }).first().click();
    await expect(page).toHaveURL(/\/register/);
  });
});
