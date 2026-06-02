import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });

  test("shows magic-link-sent page after submitting email", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder(/email/i).fill("test@example.com");
    await page.getByRole("button", { name: /send magic link/i }).click();
    await expect(page).toHaveURL(/magic-link-sent/);
  });

  test("redirects unauthenticated users from /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });
});
