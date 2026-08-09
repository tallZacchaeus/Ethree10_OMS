import { defineConfig } from "vitest/config";
import { resolve } from "path";

/**
 * Documentation and configuration drift alarms.
 *
 * These assert that files exist and contain certain strings — they test no
 * behaviour. They are genuinely useful (they are what caught the stale role
 * guides and the missing migration lock), but counting them in the headline
 * unit-test number flattered the suite: "72 tests passing" included ~15 that
 * could never catch a broken money rule.
 *
 * Run with `pnpm test:docs`, or everything with `pnpm test:all`.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/unit/setup.ts"],
    include: ["tests/docs/**/*.test.ts"],
  },
  resolve: { alias: { "@": resolve(__dirname, ".") } },
});
