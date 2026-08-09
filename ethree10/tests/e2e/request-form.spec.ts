import { test, expect } from "@playwright/test";

/**
 * The client's whole journey: submit without an account, get a tracking link,
 * see the request, and talk to the team.
 *
 * The form deliberately no longer asks for a service, an urgency, an expected
 * outcome or acceptance criteria — those are the agency's job at triage. This
 * spec previously filled `acceptanceCriteria`, a field that no longer exists,
 * so it could only fail.
 */
test("a client submits a request and can track it without an account", async ({ page }) => {
  await page.goto("/request");
  await expect(page.getByText("Start a Project", { exact: true })).toBeVisible();

  await page.locator('input[name="requesterName"]').fill("John Doe Test");
  await page.locator('input[name="requesterEmail"]').fill(`john-${Date.now()}@e2e.example`);
  await page.locator('input[name="organizationName"]').fill("E2E Test Organization");
  await page.locator('input[name="title"]').fill("E2E service request");
  await page
    .locator('textarea[name="description"]')
    .fill("We need a simple sign-up page for our outreach programme.");
  await page
    .locator('textarea[name="expectedDeliverables"]')
    .fill("A shareable sign-up page and a way to export registrations.");
  // A deadline is required; supporting links and budget are not.
  const deadline = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  await page.locator('input[name="deadline"]').fill(deadline);
  await page.locator('input[name="consentToEmail"]').check();

  await page.getByRole("button", { name: "Submit Request" }).click();

  await expect(page.getByText("Request submitted", { exact: true })).toBeVisible({ timeout: 20_000 });

  const trackingLink = page.getByRole("link", { name: "Track my request" });
  await expect(trackingLink).toBeVisible();
  await trackingLink.click();

  await expect(page.getByText("E2E service request", { exact: true })).toBeVisible();

  // The client can talk to the team from the link.
  await page.getByLabel("Your message").fill("E2E client follow-up message");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByText("E2E client follow-up message", { exact: true })).toBeVisible();
});

test("the public form does not leak internal branch names", async ({ page }) => {
  await page.goto("/request");
  const body = await page.locator("body").innerText();
  for (const internal of ["Digital Media", "Tech & Product", "Agency fallback", "Agency review"]) {
    expect(body).not.toContain(internal);
  }
});
