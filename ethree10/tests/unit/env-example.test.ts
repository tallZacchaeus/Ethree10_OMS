import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_EXAMPLE_PATH = resolve(process.cwd(), ".env.example");

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "REDIS_URL",
  "INTEGRATION_SECRET_KEY",
  "STORAGE_ENDPOINT",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_BUCKET",
  "STORAGE_PUBLIC_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_STORAGE_URL",
] as const;

const REMOVED_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

describe(".env.example", () => {
  it("documents the current required environment contract", () => {
    const contents = readFileSync(ENV_EXAMPLE_PATH, "utf8");

    for (const key of REQUIRED_KEYS) {
      expect(contents).toContain(`${key}=`);
    }

    for (const key of REMOVED_KEYS) {
      expect(contents).not.toContain(`${key}=`);
    }
  });
});
