import { describe, expect, it } from "vitest";
import {
  formatPercentage,
  getCapacityStatus,
  getDashboardExperience,
  summarizeThroughput,
} from "@/lib/dashboard";

describe("dashboard helpers", () => {
  it("gives admins the full leadership dashboard", () => {
    const experience = getDashboardExperience(["agency_admin"], false);

    expect(experience.isAgencyLead).toBe(true);
    expect(experience.isTeamHead).toBe(true);
    expect(experience.isMember).toBe(true);
  });

  it("gives the executive a focused agency-wide overview only", () => {
    const experience = getDashboardExperience(["finance_admin"], false);

    // Agency-wide read surface...
    expect(experience.isAgencyLead).toBe(true);
    expect(experience.isExecutive).toBe(true);
    // ...but not the operational/personal surfaces (read-only oversight).
    expect(experience.isTeamHead).toBe(false);
    expect(experience.isMember).toBe(false);
    expect(experience.isMember).toBe(false);
  });

  it("summarizes throughput from real completed work signals", () => {
    expect(
      summarizeThroughput({
        tasksCompletedLast7Days: 11,
        deliveredProjectsLast30Days: 3,
        closedRequestsLast30Days: 4,
      }),
    ).toBe(18);
  });

  it("classifies capacity using the load ratio", () => {
    expect(getCapacityStatus(2.4)).toEqual({ label: "Overloaded", variant: "destructive" });
    expect(getCapacityStatus(1.4)).toEqual({ label: "At Capacity", variant: "warning" });
    expect(getCapacityStatus(0.7)).toEqual({ label: "Healthy", variant: "success" });
    expect(getCapacityStatus(null)).toEqual({ label: "Unassigned", variant: "neutral" });
  });

  it("formats rates in a user-friendly way", () => {
    expect(formatPercentage(0.875)).toBe("88%");
    expect(formatPercentage(undefined)).toBe("0%");
  });
});
