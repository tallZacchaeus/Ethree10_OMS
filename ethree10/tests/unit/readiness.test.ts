import { describe, expect, it } from "vitest";
import {
  evaluateDatabaseReadiness,
  evaluateEnvironmentReadiness,
  summarizeReadiness,
} from "@/lib/readiness";

const READY_ENV: NodeJS.ProcessEnv = {
  DATABASE_URL: "postgresql://user:password@db.ethree10.com:5432/ethree10",
  DIRECT_URL: "postgresql://user:password@db.ethree10.com:5432/ethree10",
  AUTH_SECRET: "real-auth-secret-with-enough-entropy",
  AUTH_URL: "https://oms.ethree10.com",
  NEXTAUTH_URL: "https://oms.ethree10.com",
  RESEND_API_KEY: "re_live_123",
  EMAIL_FROM: "Ethree10 <noreply@ethree10.com>",
  REDIS_URL: "redis://redis.ethree10.com:6379",
  INTEGRATION_SECRET_KEY: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  STORAGE_ENDPOINT: "https://storage.ethree10.com",
  STORAGE_ACCESS_KEY: "storage-access",
  STORAGE_SECRET_KEY: "storage-secret",
  STORAGE_BUCKET: "ethree10",
  STORAGE_PUBLIC_URL: "https://oms.ethree10.com/files",
  NEXT_PUBLIC_APP_URL: "https://oms.ethree10.com",
  NEXT_PUBLIC_STORAGE_URL: "https://oms.ethree10.com/files",
  PAYSTACK_SECRET_KEY: "sk_live_real",
  NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY: "pk_live_real",
  NEXT_PUBLIC_POSTHOG_KEY: "phc_real",
  SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
  NEXT_PUBLIC_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
  NODE_ENV: "production",
};

describe("launch readiness", () => {
  it("passes a production-shaped environment", () => {
    const checks = evaluateEnvironmentReadiness(READY_ENV, {
      production: true,
      nodeVersion: "v24.4.1",
    });

    expect(summarizeReadiness(checks).failures).toBe(0);
  });

  it("fails launch readiness for missing NEXTAUTH_URL and placeholder secrets", () => {
    const checks = evaluateEnvironmentReadiness(
      {
        ...READY_ENV,
        NEXTAUTH_URL: "",
        AUTH_URL: "http://localhost:3000",
        NEXT_PUBLIC_APP_URL: "https://oms.ethree10.com",
        INTEGRATION_SECRET_KEY: "a".repeat(64),
        PAYSTACK_SECRET_KEY: "",
      },
      { production: true, nodeVersion: "v22.17.1" },
    );

    const failures = checks.filter((item) => item.status === "fail").map((item) => item.key);

    expect(failures).toContain("env.required");
    expect(failures).toContain("auth.url-alignment");
    expect(failures).toContain("env.https");
    expect(failures).toContain("integrations.secret");
    expect(failures).toContain("runtime.node");
    expect(failures).toContain("payments.paystack");
  });

  it("summarizes database readiness from seed-derived counts", () => {
    const checks = evaluateDatabaseReadiness({
      teams: 2,
      teamsWithHeads: 2,
      services: 8,
      acceptedStaff: 2,
      superAdmins: 1,
      organizations: 1,
    });

    expect(summarizeReadiness(checks)).toEqual({ passed: 6, warnings: 0, failures: 0 });
  });
});
