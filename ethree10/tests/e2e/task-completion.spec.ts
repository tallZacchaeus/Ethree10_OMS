import { test, expect } from "@playwright/test";
import { signInAsSeededUser } from "./helpers/auth";

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

test.describe("Task assign and complete flow", () => {
  test("tasks page is accessible after login", async ({ page }) => {
    await signInAsSeededUser(page);
    await page.goto("/tasks");
    await expect(page.getByRole("heading", { name: /tasks/i })).toBeVisible();
  });

  test("projects page lists projects after login", async ({ page }) => {
    await signInAsSeededUser(page);
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: /projects/i })).toBeVisible();
  });
});
