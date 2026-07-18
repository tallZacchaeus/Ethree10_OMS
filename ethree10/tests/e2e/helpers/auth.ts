import type { Page } from "@playwright/test";

export async function signInAsSeededUser(
  page: Page,
  email = "admin@ethree10.r4c.global",
) {
  await page.goto("/login");
  await page.getByRole("button", { name: "Quick Login (Local Dev)" }).click();
  await page.getByLabel("Seeded user email").fill(email);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 20_000 });
}
