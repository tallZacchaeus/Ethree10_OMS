import { vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    DIRECT_URL: "postgresql://test:test@localhost:5432/test",
    AUTH_SECRET: "test-secret-32-chars-long-enough!!",
    AUTH_URL: "http://localhost:3000",
    AUTH_GOOGLE_ID: "test-google-client-id",
    AUTH_GOOGLE_SECRET: "test-google-client-secret",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "test@test.com",
    REDIS_URL: "redis://localhost:6379",
    INTEGRATION_SECRET_KEY: "a".repeat(64),
    NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
    NODE_ENV: "test",
  },
}));
