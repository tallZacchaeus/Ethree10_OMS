import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.unmock("@/lib/env");

const VALID_ENV: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  DIRECT_URL: "postgresql://user:pass@localhost:5432/db",
  AUTH_SECRET: "a-secret-that-is-long-enough-yes!",
  AUTH_URL: "http://localhost:3000",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "noreply@example.com",
  REDIS_URL: "redis://localhost:6379",
  INTEGRATION_SECRET_KEY: "a".repeat(64),
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
  NODE_ENV: "test",
};

describe("lib/env - environment validation", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("accepts valid environment variables", async () => {
    process.env = { ...process.env, ...VALID_ENV };
    const { env } = await import("@/lib/env");
    expect(env.DATABASE_URL).toBe("postgresql://user:pass@localhost:5432/db");
    expect(env.AUTH_SECRET).toBe("a-secret-that-is-long-enough-yes!");
    expect(env.REDIS_URL).toBe("redis://localhost:6379");
  });

  it("throws when DATABASE_URL is missing", async () => {
    process.env = { ...process.env, ...VALID_ENV };
    delete process.env["DATABASE_URL"];
    await expect(import("@/lib/env")).rejects.toThrow();
  });

  it("throws when INTEGRATION_SECRET_KEY is shorter than 64 chars", async () => {
    process.env = {
      ...process.env,
      ...VALID_ENV,
      INTEGRATION_SECRET_KEY: "tooshort",
    };
    await expect(import("@/lib/env")).rejects.toThrow();
  });
});
