import { test, expect } from '@playwright/test';

test('submit public request form', async ({ page }) => {
  // Navigate to the public request form
  await page.goto('http://localhost:3000/request');

  // Verify the page loaded by checking the title
  await expect(page.getByText('Start a Project', { exact: true })).toBeVisible();

  // Fill out the form
  await page.fill('input[name="name"]', 'John Doe Test');
  await page.fill('input[name="email"]', 'john@example.com');
  await page.fill('input[name="organization"]', 'Test Organization');
  await page.fill('input[name="phone"]', '+1234567890');
  await page.fill('textarea[name="message"]', 'This is a test project request from Playwright automation.');

  // Submit the form
  await page.click('button[type="submit"]');

  // Verify success toast/message appears
  await expect(page.locator('text=Request submitted successfully')).toBeVisible({ timeout: 10000 });
});
