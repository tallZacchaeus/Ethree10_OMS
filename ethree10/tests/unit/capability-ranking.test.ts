import { describe, it, expect } from "vitest";
import type { SkillLevel } from "@prisma/client";
import { CAPABILITY_RANK } from "@/server/services/capability";

/**
 * Ranking is what step 4 will pick an assignee with, so the ordering needs to
 * be pinned before anything depends on it. A silent reordering here would
 * quietly change who gets proposed for work.
 */
describe("capability ranking", () => {
  it("orders levels from beginner to expert", () => {
    const ordered = (Object.keys(CAPABILITY_RANK) as SkillLevel[]).sort(
      (a, b) => CAPABILITY_RANK[a] - CAPABILITY_RANK[b],
    );
    expect(ordered).toEqual(["beginner", "intermediate", "advanced", "expert"]);
  });

  it("covers every level the schema defines", () => {
    // If SkillLevel gains a value and this map does not, ranking would return
    // undefined for it and sort unpredictably rather than failing loudly.
    const levels: SkillLevel[] = ["beginner", "intermediate", "advanced", "expert"];
    for (const level of levels) {
      expect(CAPABILITY_RANK[level], `${level} must have a rank`).toBeTypeOf("number");
    }
    expect(Object.keys(CAPABILITY_RANK)).toHaveLength(levels.length);
  });

  it("sorts a candidate list most capable first", () => {
    const people = [
      { name: "beginner", level: "beginner" as SkillLevel },
      { name: "expert", level: "expert" as SkillLevel },
      { name: "intermediate", level: "intermediate" as SkillLevel },
      { name: "advanced", level: "advanced" as SkillLevel },
    ];
    const sorted = [...people].sort((a, b) => CAPABILITY_RANK[b.level] - CAPABILITY_RANK[a.level]);
    expect(sorted.map((p) => p.name)).toEqual(["expert", "advanced", "intermediate", "beginner"]);
  });
});
