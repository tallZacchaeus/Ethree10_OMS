import { test, expect } from "@playwright/test";

/**
 * E2E scenario 6: Marketing-site lead flow.
 *
 * Tests that the public request / lead form on the marketing site
 * is accessible and renders correctly.  Full conversion (agency lead
 * converts → external workspace created) requires authenticated state
 * and is covered in integration tests.
 */

test.describe("Marketing site lead flow", () => {
  test("home page renders", async ({ page }) => {
    await page.goto("/");
    // Root redirects to login when unauthenticated
    await expect(page).toHaveURL(/login/);
  });

  test("public request form renders on /request", async ({ page }) => {
    await page.goto("/request");
    await expect(page.getByText("Start a Project", { exact: true })).toBeVisible();
  });

  test("about page renders", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("heading", { name: /about ethree10/i })).toBeVisible();
  });

  test("services page renders", async ({ page }) => {
    await page.goto("/services");
    await expect(page.getByRole("heading", { name: "Services" })).toBeVisible();
  });

  test("contact page renders", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: "Contact Us" })).toBeVisible();
  });

  test("leads list is protected", async ({ page }) => {
    await page.goto("/leads");
    await expect(page).toHaveURL(/login/);
  });
});
