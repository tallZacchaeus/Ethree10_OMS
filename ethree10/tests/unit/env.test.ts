import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/lib/env");

const VALID_ENV: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgresql://user:password@localhost:5432/db",
  DIRECT_URL: "postgresql://user:password@localhost:5432/db",
  AUTH_SECRET: "a-secret-that-is-long-enough-yes!",
  AUTH_URL: "http://localhost:3000",
  NEXTAUTH_URL: "http://localhost:3000",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "noreply@example.com",
  REDIS_URL: "redis://localhost:6379",
  INTEGRATION_SECRET_KEY: "a".repeat(64),
  STORAGE_ENDPOINT: "http://127.0.0.1:9000",
  STORAGE_ACCESS_KEY: "minioadmin",
  STORAGE_SECRET_KEY: "minioadmin",
  STORAGE_BUCKET: "ethree10-test",
  STORAGE_PUBLIC_URL: "http://localhost:3000/files",
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_STORAGE_URL: "http://localhost:3000/files",
  NODE_ENV: "test",
};

const ORIGINAL_ENV = { ...process.env };

async function importFreshEnv() {
  vi.resetModules();
  return import("@/lib/env");
}

describe("lib/env - environment validation", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("accepts valid environment variables", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      ...VALID_ENV,
    };

    const { env, clientEnv } = await importFreshEnv();

    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(env.AUTH_SECRET).toBe(VALID_ENV.AUTH_SECRET);
    expect(env.NEXTAUTH_URL).toBe(VALID_ENV.NEXTAUTH_URL);
    expect(env.STORAGE_ENDPOINT).toBe(VALID_ENV.STORAGE_ENDPOINT);
    expect(clientEnv.NEXT_PUBLIC_STORAGE_URL).toBe(VALID_ENV.NEXT_PUBLIC_STORAGE_URL);
  });

  it("throws when DATABASE_URL is missing", async () => {
    const { DATABASE_URL, ...rest } = VALID_ENV;
    process.env = {
      ...ORIGINAL_ENV,
      ...rest,
    };

    await expect(importFreshEnv()).rejects.toThrow(
      "Invalid environment variables. Check .env.example for required keys.",
    );
  });

  it("throws when INTEGRATION_SECRET_KEY is shorter than 64 chars", async () => {
    process.env = {
      ...ORIGINAL_ENV,
      ...VALID_ENV,
      INTEGRATION_SECRET_KEY: "tooshort",
    };

    await expect(importFreshEnv()).rejects.toThrow(
      "Invalid environment variables. Check .env.example for required keys.",
    );
  });
});
