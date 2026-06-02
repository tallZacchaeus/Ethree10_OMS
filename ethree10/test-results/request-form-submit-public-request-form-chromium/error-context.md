# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: request-form.spec.ts >> submit public request form
- Location: tests/e2e/request-form.spec.ts:3:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('text=Request submitted successfully')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Request submitted successfully')

```

```yaml
- banner:
  - link "Ethree10":
    - /url: /
  - navigation:
    - link "Services":
      - /url: /services
    - link "About":
      - /url: /about
    - link "Contact":
      - /url: /contact
    - link "Sign in":
      - /url: /login
- text: Start a Project Tell us about your organization and what you're looking to build. Our team will review your request and get in touch. Full Name *
- textbox "Full Name *":
  - /placeholder: Jane Doe
  - text: John Doe Test
- text: Email *
- textbox "Email *":
  - /placeholder: jane@example.com
  - text: john@example.com
- text: Organization
- textbox "Organization":
  - /placeholder: Your Ministry or NGO
  - text: Test Organization
- text: Phone Number
- textbox "Phone Number":
  - /placeholder: "+1234567890"
  - text: "+1234567890"
- text: Project Description *
- textbox "Project Description *":
  - /placeholder: Please describe your project, timeline, and any specific requirements...
  - text: This is a test project request from Playwright automation.
- button "Submit Request"
- contentinfo:
  - paragraph: Ethree10
  - paragraph: A Reach4Christ Global initiative. Excellence through People, Process, Product.
  - navigation:
    - link "Services":
      - /url: /services
    - link "About":
      - /url: /about
    - link "Start a project":
      - /url: /request
    - link "Sign in":
      - /url: /login
- region "Notifications (F8)":
  - list
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('submit public request form', async ({ page }) => {
  4  |   // Navigate to the public request form
  5  |   await page.goto('http://localhost:3000/request');
  6  | 
  7  |   // Verify the page loaded by checking the title
  8  |   await expect(page.getByText('Start a Project', { exact: true })).toBeVisible();
  9  | 
  10 |   // Fill out the form
  11 |   await page.fill('input[name="name"]', 'John Doe Test');
  12 |   await page.fill('input[name="email"]', 'john@example.com');
  13 |   await page.fill('input[name="organization"]', 'Test Organization');
  14 |   await page.fill('input[name="phone"]', '+1234567890');
  15 |   await page.fill('textarea[name="message"]', 'This is a test project request from Playwright automation.');
  16 | 
  17 |   // Submit the form
  18 |   await page.click('button[type="submit"]');
  19 | 
  20 |   // Verify success toast/message appears
> 21 |   await expect(page.locator('text=Request submitted successfully')).toBeVisible({ timeout: 10000 });
     |                                                                     ^ Error: expect(locator).toBeVisible() failed
  22 | });
  23 | 
```