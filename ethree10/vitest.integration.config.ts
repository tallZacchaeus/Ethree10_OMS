import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Integration tests run against REAL infrastructure (Postgres + MinIO + the real
// env), unlike unit tests which mock `@/lib/env`. Run them locally with
// `pnpm test:integration` after `docker compose up -d`. They are intentionally
// excluded from the default `pnpm test` run and from CI (no MinIO in CI).
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/integration/setup.ts"],
    include: ["tests/integration/**/*.test.ts"],
    // Real DB writes must not race across files.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
