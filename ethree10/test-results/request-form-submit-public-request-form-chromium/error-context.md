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
Error: strict mode violation: locator('text=Request submitted successfully') resolved to 2 elements:
    1) <div class="text-sm font-semibold">Request submitted successfully</div> aka getByText('Request submitted successfully', { exact: true })
    2) <span role="status" aria-live="assertive">Notification Request submitted successfullyWe wil…</span> aka getByText('Notification Request')

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('text=Request submitted successfully')

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - banner [ref=e3]:
      - generic [ref=e4]:
        - link "Ethree10" [ref=e5] [cursor=pointer]:
          - /url: /
        - navigation [ref=e6]:
          - link "Services" [ref=e7] [cursor=pointer]:
            - /url: /services
          - link "About" [ref=e8] [cursor=pointer]:
            - /url: /about
          - link "Contact" [ref=e9] [cursor=pointer]:
            - /url: /contact
          - button [ref=e10] [cursor=pointer]:
            - img
          - link "Login" [ref=e11] [cursor=pointer]:
            - /url: /login
    - generic [ref=e14]:
      - generic [ref=e15]:
        - generic [ref=e16]: Start a Project
        - generic [ref=e17]: Tell us about your organization and what you're looking to build. Our team will review your request and get in touch.
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]:
            - text: Full Name *
            - textbox "Full Name *" [ref=e22]:
              - /placeholder: Jane Doe
              - text: John Doe Test
          - generic [ref=e23]:
            - text: Email *
            - textbox "Email *" [ref=e24]:
              - /placeholder: jane@example.com
              - text: john@example.com
        - generic [ref=e25]:
          - generic [ref=e26]:
            - text: Organization
            - textbox "Organization" [ref=e27]:
              - /placeholder: Your Ministry or NGO
              - text: Test Organization
          - generic [ref=e28]:
            - text: Phone Number
            - textbox "Phone Number" [ref=e29]:
              - /placeholder: "+1234567890"
              - text: "+1234567890"
        - generic [ref=e30]:
          - text: Project Description *
          - textbox "Project Description *" [ref=e31]:
            - /placeholder: Please describe your project, timeline, and any specific requirements...
            - text: This is a test project request from Playwright automation.
        - button "Submit Request" [ref=e32] [cursor=pointer]
    - contentinfo [ref=e33]:
      - generic [ref=e34]:
        - generic [ref=e35]:
          - paragraph [ref=e36]: Ethree10
          - paragraph [ref=e37]: A Reach4Christ Global initiative. Excellence through People, Process, Product.
        - navigation [ref=e38]:
          - link "Services" [ref=e39] [cursor=pointer]:
            - /url: /services
          - link "About" [ref=e40] [cursor=pointer]:
            - /url: /about
          - link "Start a project" [ref=e41] [cursor=pointer]:
            - /url: /request
          - link "Sign in" [ref=e42] [cursor=pointer]:
            - /url: /login
  - region "Notifications (F8)":
    - list [ref=e44]:
      - listitem [ref=e45]:
        - generic [ref=e46]:
          - generic [ref=e47]: Request submitted successfully
          - generic [ref=e48]: We will get back to you shortly.
        - button [ref=e49] [cursor=pointer]:
          - img [ref=e50]
  - alert [ref=e54]
  - status [ref=e55]: Notification Request submitted successfullyWe will get back to you shortly.
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