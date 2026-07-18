import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import importPlugin from "eslint-plugin-import";

export default defineConfig([
  globalIgnores([".next/**", "node_modules/**", "test-results/**", "playwright-report/**"]),
  ...nextVitals,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      import: importPlugin,
    },
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],
      "import/no-cycle": "error",
      "import/no-self-import": "error",
    },
  },
  {
    files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}"],
    ignores: ["app/api/**/*.{ts,tsx}", "app/**/layout.tsx", "app/**/page.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/db/*", "@/server/services/*", "@/server/trpc/routers/*"],
              message: "Direct server imports are not allowed in client code. Use tRPC hooks.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["server/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/components/*", "@/app/*"],
              message: "Server code must not import from client components or app routes.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "app/(app)/profile/page.tsx",
      "app/(app)/reports/**/page.tsx",
      "components/LanguageSwitcher.tsx",
      "components/layout/mobile-nav.tsx",
      "components/scorecards/scorecard-editor-dialog.tsx",
      "lib/hooks/use-translation.ts",
    ],
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
    },
  },
]);
