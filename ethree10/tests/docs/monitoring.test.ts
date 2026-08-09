import { describe, expect, it } from "vitest";
import { evaluateMonitoringReadiness } from "@/scripts/check-monitoring";

describe("monitoring readiness", () => {
  it("passes with production monitoring values", () => {
    const checks = evaluateMonitoringReadiness({
      SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
      NEXT_PUBLIC_SENTRY_DSN: "https://public@example.ingest.sentry.io/1",
      NEXT_PUBLIC_POSTHOG_KEY: "phc_real",
      NEXT_PUBLIC_POSTHOG_HOST: "https://app.posthog.com",
      MONITORING_ALERT_EMAIL: "softdevs@theincubatorhub.org",
      UPTIME_MONITOR_URL: "https://oms.ethree10.com/api/health?mode=ready",
    });

    expect(checks.filter((check) => !check.pass)).toEqual([]);
  });

  it("fails missing telemetry and wrong uptime target", () => {
    const checks = evaluateMonitoringReadiness({
      UPTIME_MONITOR_URL: "https://oms.ethree10.com/api/health?mode=live",
    });

    expect(checks.filter((check) => !check.pass).map((check) => check.name)).toEqual([
      "server error reporting",
      "client error reporting",
      "product analytics",
      "alert destination",
      "uptime monitor target",
    ]);
  });
});
