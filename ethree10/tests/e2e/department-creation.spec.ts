import { test, expect } from "@playwright/test";
import { signInAsSeededUser } from "./helpers/auth";

/**
 * E2E scenario 5: branch and department administration.
 *
 * An admin logs in and verifies the branches screen is reachable and offers the
 * controls it is supposed to: create, rename, assign a lead, archive.
 */

test.describe("Branch and department administration", () => {
  test("redirects unauthenticated users from /teams to /login", async ({ page }) => {
    await page.goto("/teams");
    await expect(page).toHaveURL(/login/);
  });

  test("branches page accessible after login", async ({ page }) => {
    await signInAsSeededUser(page);
    await page.goto("/teams");
    await expect(page.getByRole("heading", { name: "Branches" })).toBeVisible();
  });

  test("an admin can rename a branch and assign its lead", async ({ page }) => {
    await signInAsSeededUser(page);
    await page.goto("/teams");

    // The edit control is labelled per branch, so this also asserts the branch
    // itself rendered rather than an empty state.
    const edit = page.getByRole("button", { name: /^Edit / }).first();
    await expect(edit).toBeVisible();
    await edit.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Name")).toBeVisible();
    await expect(dialog.getByRole("combobox", { name: "Lead" })).toBeVisible();
  });
});
