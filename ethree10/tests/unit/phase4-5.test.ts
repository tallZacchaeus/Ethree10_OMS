import { describe, expect, it } from "vitest";
import { generatePublicToken } from "@/lib/utils/codes";
import { simplifiedRequestStatus } from "@/server/services/client-tracking";
import { reportPeriodBounds, REPORT_TIMEZONE } from "@/server/services/report";

describe("Phase 4 capability tracking", () => {
  it("generates unique high-entropy URL-safe tokens", () => {
    const tokens = Array.from({ length: 100 }, () => generatePublicToken());
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens.every((token) => token.length === 32 && /^[A-Za-z0-9_-]+$/.test(token))).toBe(true);
  });

  it("exposes simplified client statuses", () => {
    expect(simplifiedRequestStatus("under_review")).toBe("Planning");
    expect(simplifiedRequestStatus("in_review")).toBe("Work in progress");
    expect(simplifiedRequestStatus("delivered")).toBe("Ready for review");
    expect(simplifiedRequestStatus("closed")).toBe("Completed");
  });
});

describe("Phase 5 Africa/Lagos report periods", () => {
  it("uses Lagos Monday-to-Sunday weekly boundaries", () => {
    const bounds = reportPeriodBounds("weekly", new Date("2026-07-17T12:00:00.000Z"));
    expect(REPORT_TIMEZONE).toBe("Africa/Lagos");
    expect(bounds.periodStart.toISOString()).toBe("2026-07-12T23:00:00.000Z");
    expect(bounds.periodEnd.toISOString()).toBe("2026-07-19T22:59:59.999Z");
    expect(bounds.cutoffAt.toISOString()).toBe("2026-07-19T23:00:00.000Z");
  });

  it("uses Lagos calendar-month boundaries", () => {
    const bounds = reportPeriodBounds("monthly", new Date("2026-07-17T12:00:00.000Z"));
    expect(bounds.periodStart.toISOString()).toBe("2026-06-30T23:00:00.000Z");
    expect(bounds.periodEnd.toISOString()).toBe("2026-07-31T22:59:59.999Z");
  });
});
