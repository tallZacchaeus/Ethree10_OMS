import { test, expect } from "@playwright/test";

/**
 * E2E scenario 7: Auth flows.
 *
 * Tests login validation, redirect behaviour for unauthenticated users,
 * and the verification entry point without calling an external email service.
 */

test.describe("Auth flows", () => {
  test("magic link form rejects malformed email", async ({ page }) => {
    await page.goto("/login");
    const email = page.getByLabel("Email address");
    await email.fill("not-an-email");
    await expect(email).toHaveJSProperty("validity.valid", false);
  });

  test("protected routes redirect unauthenticated users to login", async ({ page }) => {
    const protectedRoutes = ["/dashboard", "/requests", "/projects", "/tasks", "/members", "/teams"];
    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/login/, { timeout: 5_000 });
    }
  });

  test("login page renders Google OAuth button", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByRole("button", { name: /continue with google/i })).toBeVisible();
  });

  test("magic-link-sent page renders correctly", async ({ page }) => {
    await page.goto("/magic-link-sent");
    await expect(page.getByText(/check your email/i)).toBeVisible();
  });
});
