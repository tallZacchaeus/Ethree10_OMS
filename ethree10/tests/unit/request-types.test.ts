import { describe, it, expect } from "vitest";
import {
  DEFAULT_DEPARTMENTS,
  DEPARTMENT_SLUGS,
  TASK_TYPES,
  TASK_TYPE_GROUPS,
  departmentSlugForTaskType,
  labelForTaskType,
  isOtherTaskType,
} from "@/lib/request-types";

describe("request task-type catalog", () => {
  it("seeds exactly the two fixed departments", () => {
    expect(DEFAULT_DEPARTMENTS.map((d) => d.slug)).toEqual([
      DEPARTMENT_SLUGS.creative,
      DEPARTMENT_SLUGS.productDevelopment,
    ]);
  });

  it("every task type routes to one of the two departments", () => {
    const valid = new Set<string>([DEPARTMENT_SLUGS.creative, DEPARTMENT_SLUGS.productDevelopment]);
    for (const t of TASK_TYPES) {
      expect(valid.has(t.departmentSlug)).toBe(true);
    }
  });

  it("has unique task-type values", () => {
    const values = TASK_TYPES.map((t) => t.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("routes representative types to the right team", () => {
    expect(departmentSlugForTaskType("branded_email")).toBe(DEPARTMENT_SLUGS.creative);
    expect(departmentSlugForTaskType("graphic_design")).toBe(DEPARTMENT_SLUGS.creative);
    expect(departmentSlugForTaskType("website")).toBe(DEPARTMENT_SLUGS.productDevelopment);
    // Budget Request was explicitly placed under Product Development.
    expect(departmentSlugForTaskType("budget_request")).toBe(DEPARTMENT_SLUGS.productDevelopment);
  });

  it("returns null for unknown / legacy free-text types (stays unrouted)", () => {
    expect(departmentSlugForTaskType("Internal Tool")).toBeNull();
    expect(departmentSlugForTaskType("")).toBeNull();
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
