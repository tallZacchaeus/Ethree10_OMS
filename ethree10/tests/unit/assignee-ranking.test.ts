import { describe, it, expect } from "vitest";
import type { SkillLevel } from "@prisma/client";
import {
  rankCandidates,
  buildRationale,
  type RankableCandidate,
} from "@/server/services/assignee-ranking";

const person = (
  name: string,
  level: SkillLevel,
  openTaskCount = 0,
  estimatedHoursRemaining = 0,
): RankableCandidate => ({
  userId: `user_${name.toLowerCase()}`,
  name,
  level,
  openTaskCount,
  estimatedHoursRemaining,
});

describe("assignee ranking", () => {
  it("puts capability ahead of load", () => {
    // The wrong person doing the work quickly is worse than the right person
    // doing it a day later, so a busy expert still beats an idle beginner.
    const ranked = rankCandidates([
      person("Idle Beginner", "beginner", 0),
      person("Busy Expert", "expert", 9),
    ]);
    expect(ranked[0]?.name).toBe("Busy Expert");
  });

  it("uses load to break ties within a capability level", () => {
    // Otherwise everything funnels to whoever happens to sort first.
    const ranked = rankCandidates([
      person("Loaded", "advanced", 7),
      person("Free", "advanced", 1),
      person("Middling", "advanced", 4),
    ]);
    expect(ranked.map((c) => c.name)).toEqual(["Free", "Middling", "Loaded"]);
  });

  it("falls back to outstanding hours when task counts match", () => {
    const ranked = rankCandidates([
      person("Heavy", "expert", 2, 30),
      person("Light", "expert", 2, 4),
    ]);
    expect(ranked[0]?.name).toBe("Light");
  });

  it("is deterministic when candidates are identical", () => {
    // Without a final tiebreak two equal candidates could swap between calls,
    // which makes the proposal look arbitrary to whoever is approving it.
    const input = [person("Zoe", "expert", 3, 5), person("Adam", "expert", 3, 5)];
    expect(rankCandidates(input).map((c) => c.name)).toEqual(["Adam", "Zoe"]);
    expect(rankCandidates([...input].reverse()).map((c) => c.name)).toEqual(["Adam", "Zoe"]);
  });

  it("does not mutate the caller's array", () => {
    const input = [person("B", "beginner"), person("A", "expert")];
    const before = input.map((c) => c.name);
    rankCandidates(input);
    expect(input.map((c) => c.name)).toEqual(before);
  });

  it("explains each placement in words a lead can read", () => {
    const [top] = rankCandidates([person("Ada", "expert", 2, 6)]);
    expect(top?.reason).toBe("expert at this service · 2 open tasks · 6h outstanding");
  });

  it("says 'task' rather than 'tasks' for a single one", () => {
    const [top] = rankCandidates([person("Solo", "advanced", 1)]);
    expect(top?.reason).toContain("1 open task");
    expect(top?.reason).not.toContain("1 open tasks");
  });

  it("omits outstanding hours when there are none to report", () => {
    const [top] = rankCandidates([person("Fresh", "intermediate", 0, 0)]);
    expect(top?.reason).toBe("intermediate at this service · 0 open tasks");
  });
});

describe("proposal rationale", () => {
  it("records who else was considered, not only who won", () => {
    // "Why them" is half the question a branch head asks; "who else" is the
    // other half, and load data will have moved on by the time anyone asks.
    const ranked = rankCandidates([
      person("Winner", "expert", 1),
      person("Second", "advanced", 0),
      person("Third", "intermediate", 0),
    ]);
    const rationale = buildRationale(ranked, "Video Production");

    expect(rationale?.chosen.name).toBe("Winner");
    expect(rationale?.service).toBe("Video Production");
    expect(rationale?.consideredCount).toBe(3);
    expect(rationale?.runnersUp.map((r) => r.name)).toEqual(["Second", "Third"]);
  });

  it("caps runners-up so the record stays readable", () => {
    const many = rankCandidates(
      Array.from({ length: 8 }, (_, i) => person(`P${i}`, "advanced", i)),
    );
    expect(buildRationale(many, "Website")?.runnersUp).toHaveLength(3);
  });

  it("returns null when there was nobody to choose from", () => {
    expect(buildRationale([], "Website")).toBeNull();
  });
});
