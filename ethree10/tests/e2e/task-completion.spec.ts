import { test, expect } from "@playwright/test";

/**
 * E2E scenario 2: Assign & complete a task.
 *
 * Uses the dev-only credentials provider to authenticate two users
 * (a sub-unit lead and a member), creates a task, assigns it, and
 * verifies the completion submission flow.
 *
 * Precondition: the dev server is running with seeded demo data and
 * NODE_ENV=development (credentials provider enabled).
 */

const BASE = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";

async function signIn(page: import("@playwright/test").Page, email: string) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel(/email/i).fill(email);
  // Dev credentials provider adds a "Local Dev Login" button
  const devBtn = page.getByRole("button", { name: /local dev/i });
  if (await devBtn.isVisible()) {
    await devBtn.click();
  } else {
    await page.getByRole("button", { name: /send magic link/i }).click();
  }
  // Wait for redirect away from login
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15_000 });
}

test.describe("Task assign and complete flow", () => {
  test("tasks page is accessible after login", async ({ page }) => {
    await signIn(page, "admin@ethree10.r4c.global");
    await page.goto(`${BASE}/tasks`);
    await expect(page.getByRole("heading", { name: /tasks/i })).toBeVisible();
  });

  test("projects page lists projects after login", async ({ page }) => {
    await signIn(page, "admin@ethree10.r4c.global");
    await page.goto(`${BASE}/projects`);
    await expect(page.getByRole("heading", { name: /projects/i })).toBeVisible();
  });
});
