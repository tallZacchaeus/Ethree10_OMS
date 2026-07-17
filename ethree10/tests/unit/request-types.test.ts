import { describe, it, expect } from "vitest";
import {
  DEFAULT_TEAMS,
  TEAM_SLUGS,
  TASK_TYPES,
  TASK_TYPE_GROUPS,
  teamSlugForTaskType,
  labelForTaskType,
  isOtherTaskType,
} from "@/lib/request-types";

describe("request task-type catalog", () => {
  it("seeds exactly the two fixed teams", () => {
    expect(DEFAULT_TEAMS.map((d) => d.slug)).toEqual([
      TEAM_SLUGS.brandsCommunications,
      TEAM_SLUGS.productDevelopment,
    ]);
  });

  it("every task type routes to one of the two teams", () => {
    const valid = new Set<string>([TEAM_SLUGS.brandsCommunications, TEAM_SLUGS.productDevelopment]);
    for (const t of TASK_TYPES) {
      expect(valid.has(t.teamSlug)).toBe(true);
    }
  });

  it("has unique task-type values", () => {
    const values = TASK_TYPES.map((t) => t.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("routes representative types to the right team", () => {
    expect(teamSlugForTaskType("branded_email")).toBe(TEAM_SLUGS.brandsCommunications);
    expect(teamSlugForTaskType("graphic_design")).toBe(TEAM_SLUGS.brandsCommunications);
    expect(teamSlugForTaskType("website")).toBe(TEAM_SLUGS.productDevelopment);
    // Budget Request was explicitly placed under Product Development.
    expect(teamSlugForTaskType("budget_request")).toBe(TEAM_SLUGS.productDevelopment);
  });

  it("returns null for unknown / legacy free-text types (stays unrouted)", () => {
    expect(teamSlugForTaskType("Internal Tool")).toBeNull();
    expect(teamSlugForTaskType("")).toBeNull();
  });

  it("flags the two Other options and offers one per group", () => {
    expect(isOtherTaskType("creative_other")).toBe(true);
    expect(isOtherTaskType("product_other")).toBe(true);
    expect(isOtherTaskType("website")).toBe(false);
    for (const group of TASK_TYPE_GROUPS) {
      expect(group.options.filter((o) => o.isOther)).toHaveLength(1);
    }
  });

  it("labels known values and falls back to the raw value", () => {
    expect(labelForTaskType("website")).toBe("Website");
    expect(labelForTaskType("Internal Tool")).toBe("Internal Tool");
  });
});
