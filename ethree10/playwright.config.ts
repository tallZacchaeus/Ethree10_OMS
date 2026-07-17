import { tmpdir } from "node:os";
import { join } from "node:path";
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
  outputDir: join(tmpdir(), `ethree10-playwright-${process.pid}`),
  timeout: 120_000,
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: 1,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: process.env["PLAYWRIGHT_BASE_URL"] ?? "http://127.0.0.1:3100",
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
        command: "pnpm e2e:server",
        url: "http://127.0.0.1:3100",
        env: {
          DATABASE_URL: process.env["DATABASE_URL"] ?? "",
          DIRECT_URL: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"] ?? "",
          E2E_TEST_AUTH: "true",
          NEXT_PUBLIC_E2E_TEST_AUTH: "true",
          NODE_ENV: "production",
        },
        reuseExistingServer: false,
        timeout: 300_000,
      },
});
