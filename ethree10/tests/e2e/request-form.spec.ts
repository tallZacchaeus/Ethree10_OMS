import { test, expect } from "@playwright/test";

test("organization submits a complete service request", async ({ page }) => {
  await page.goto("/request");
  await expect(page.getByText("Start a Project", { exact: true })).toBeVisible();
  await page.locator('input[name="requesterName"]').fill("John Doe Test");
  await page.locator('input[name="requesterEmail"]').fill(`john-${Date.now()}@phase2.example`);
  await page.locator('input[name="organizationName"]').fill("Phase 2 E2E Organization");
  await page.locator('input[name="title"]').fill("Phase 2 service request");
  await page.getByRole("combobox").first().click();
  await page.getByRole("option").first().click();
  await page.locator('textarea[name="description"]').fill("A complete problem statement for the selected service.");
  await page.locator('textarea[name="expectedOutcome"]').fill("A measurable improvement for the requesting organization.");
  await page.locator('textarea[name="expectedDeliverables"]').fill("A reviewed and documented final solution.");
  await page.locator('textarea[name="acceptanceCriteria"]').fill("The agreed requirements and quality checks all pass.");
  await page.locator('input[name="consentToEmail"]').check();
  await page.getByRole("button", { name: "Submit Request" }).click();
  await expect(page.getByText("Request submitted", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: "Track my request" })).toBeVisible();
});
