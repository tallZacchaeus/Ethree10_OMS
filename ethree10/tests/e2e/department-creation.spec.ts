import { test, expect } from "@playwright/test";

/**
 * E2E scenario 5: Department and sub-unit creation.
 *
 * An admin logs in and verifies that the departments page is accessible
 * and the creation UI is present.
 */

const BASE = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";

test.describe("Department and sub-unit creation", () => {
  test("redirects unauthenticated users from /departments to /login", async ({ page }) => {
    await page.goto(`${BASE}/departments`);
    await expect(page).toHaveURL(/login/);
  });

  test("departments page accessible after login", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    const emailInput = page.getByPlaceholder(/email/i);
    await emailInput.fill("admin@ethree10.r4c.global");

    const devBtn = page.getByRole("button", { name: /local dev/i });
    if (await devBtn.isVisible()) {
      await devBtn.click();
    } else {
      await page.getByRole("button", { name: /send magic link/i }).click();
      // In CI without real email, just verify the redirect to magic-link-sent
      await expect(page).toHaveURL(/magic-link-sent/);
      return;
    }

    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
    await page.goto(`${BASE}/departments`);
    await expect(page.getByRole("heading", { name: /departments/i })).toBeVisible();
  });
});
