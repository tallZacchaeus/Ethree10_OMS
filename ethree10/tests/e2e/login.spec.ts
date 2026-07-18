import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("renders the login form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Sign in", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });

  test("redirects unauthenticated users from /dashboard to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });
});
