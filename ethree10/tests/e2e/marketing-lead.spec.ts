import { test, expect } from "@playwright/test";

/**
 * E2E scenario 6: Marketing-site lead flow.
 *
 * Tests that the public request / lead form on the marketing site
 * is accessible and renders correctly.  Full conversion (agency lead
 * converts → external workspace created) requires authenticated state
 * and is covered in integration tests.
 */

const BASE = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";

test.describe("Marketing site lead flow", () => {
  test("home page renders", async ({ page }) => {
    await page.goto(`${BASE}/`);
    // Root redirects to login when unauthenticated
    await expect(page).toHaveURL(/login/);
  });

  test("public request form renders on /request", async ({ page }) => {
    await page.goto(`${BASE}/request`);
    await expect(page.getByText(/start a project/i)).toBeVisible();
  });

  test("about page renders", async ({ page }) => {
    await page.goto(`${BASE}/about`);
    await expect(page.getByRole("heading", { name: /about ethree10/i })).toBeVisible();
  });

  test("services page renders", async ({ page }) => {
    await page.goto(`${BASE}/services`);
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("contact page renders", async ({ page }) => {
    await page.goto(`${BASE}/contact`);
    await expect(page.getByRole("heading")).toBeVisible();
  });

  test("leads list is protected", async ({ page }) => {
    await page.goto(`${BASE}/leads`);
    await expect(page).toHaveURL(/login/);
  });
});
