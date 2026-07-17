import { test, expect } from "@playwright/test";

test.describe("Client tracking security", () => {
  test("an invalid tracking token does not disclose request data", async ({ page }) => {
    await page.goto("/track/not-a-real-tracking-token");
    await expect(page.getByText("Link not found", { exact: true })).toBeVisible();
    await expect(page.getByText(/invalid or has expired/i)).toBeVisible();
  });
});
