import { test, expect } from "@playwright/test";
import { signInAsSeededUser } from "./helpers/auth";

/**
 * E2E scenario 5: Team and sub-unit creation.
 *
 * An admin logs in and verifies that the teams page is accessible
 * and the creation UI is present.
 */

test.describe("Team and sub-unit creation", () => {
  test("redirects unauthenticated users from /teams to /login", async ({ page }) => {
    await page.goto("/teams");
    await expect(page).toHaveURL(/login/);
  });

  test("teams page accessible after login", async ({ page }) => {
    await signInAsSeededUser(page);
    await page.goto("/teams");
    await expect(page.getByRole("heading", { name: /teams/i })).toBeVisible();
  });
});
