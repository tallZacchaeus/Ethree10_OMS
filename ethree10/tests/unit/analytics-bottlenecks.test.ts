import { describe, expect, it } from "vitest";
import { computeBottlenecks, type StageEventInput } from "@/server/services/analytics";

const at = (iso: string) => new Date(iso);

describe("computeBottlenecks", () => {
  it("returns an empty array when there are no events", () => {
    expect(computeBottlenecks([])).toEqual([]);
  });

  it("returns nothing for a request that never left its first stage (no divide-by-zero)", () => {
    const events: StageEventInput[] = [
      { requestId: "r1", toStage: "submitted", createdAt: at("2026-01-01T00:00:00Z") },
    ];
    expect(computeBottlenecks(events)).toEqual([]);
  });

  it("computes dwell time per transition for a single request", () => {
    const events: StageEventInput[] = [
      { requestId: "r1", toStage: "submitted", createdAt: at("2026-01-01T00:00:00Z") },
      { requestId: "r1", toStage: "under_review", createdAt: at("2026-01-02T00:00:00Z") }, // 1 day in submitted
      { requestId: "r1", toStage: "scoping", createdAt: at("2026-01-05T00:00:00Z") }, // 3 days in under_review
    ];

    expect(computeBottlenecks(events)).toEqual([
      { stage: "Submitted → Under Review", avgDays: 1 },
      { stage: "Under Review → Scoping", avgDays: 3 },
    ]);
  });

  it("averages the same transition across multiple requests", () => {
    const events: StageEventInput[] = [
      // r1: 1 day in submitted
      { requestId: "r1", toStage: "submitted", createdAt: at("2026-01-01T00:00:00Z") },
      { requestId: "r1", toStage: "under_review", createdAt: at("2026-01-02T00:00:00Z") },
      // r2: 3 days in submitted
      { requestId: "r2", toStage: "submitted", createdAt: at("2026-02-01T00:00:00Z") },
      { requestId: "r2", toStage: "under_review", createdAt: at("2026-02-04T00:00:00Z") },
    ];

    expect(computeBottlenecks(events)).toEqual([
      { stage: "Submitted → Under Review", avgDays: 2 }, // (1 + 3) / 2
    ]);
  });

  it("sorts rows by lifecycle order and rounds to one decimal", () => {
    const events: StageEventInput[] = [
      { requestId: "r1", toStage: "submitted", createdAt: at("2026-01-01T00:00:00Z") },
      { requestId: "r1", toStage: "under_review", createdAt: at("2026-01-02T12:00:00Z") }, // 1.5 days
      { requestId: "r1", toStage: "approved", createdAt: at("2026-01-03T00:00:00Z") }, // 0.5 days in under_review
    ];

    const rows = computeBottlenecks(events);
    expect(rows.map((r) => r.stage)).toEqual([
      "Submitted → Under Review",
      "Under Review → Approved",
    ]);
    expect(rows[0]?.avgDays).toBe(1.5);
    expect(rows[1]?.avgDays).toBe(0.5);
  });

  it("handles events supplied out of chronological order", () => {
    const events: StageEventInput[] = [
      { requestId: "r1", toStage: "scoping", createdAt: at("2026-01-05T00:00:00Z") },
      { requestId: "r1", toStage: "submitted", createdAt: at("2026-01-01T00:00:00Z") },
      { requestId: "r1", toStage: "under_review", createdAt: at("2026-01-02T00:00:00Z") },
    ];

    expect(computeBottlenecks(events)).toEqual([
      { stage: "Submitted → Under Review", avgDays: 1 },
      { stage: "Under Review → Scoping", avgDays: 3 },
    ]);
  });
});
