import { defineConfig, devices } from "@playwright/test";

// Locally, load .env so specs that talk to Postgres directly (e.g. the
// invoice/receipt money-path spec) get DATABASE_URL. In CI the env is provided
// by the workflow, so we only load when DATABASE_URL isn't already set.
if (!process.env["DATABASE_URL"]) {
  const proc = process as NodeJS.Process & { loadEnvFile?: (path?: string) => void };
  try {
    proc.loadEnvFile?.(".env");
  } catch {
    /* no .env present — rely on the ambient environment */
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env["CI"]
    ? undefined
    : {
        command: "pnpm dev:next",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
