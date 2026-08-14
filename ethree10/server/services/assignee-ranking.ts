import type { SkillLevel } from "@prisma/client";
import { CAPABILITY_RANK } from "@/server/services/capability";

/**
 * Choosing who to propose for a task.
 *
 * Pure, for the same reason as the eligibility and approval rules: the
 * integration suite does not run in CI, and this decides who gets given work.
 * A silent change in ordering would quietly redistribute the agency's workload.
 *
 * Step 4 of docs/service-assignment-plan.md.
 */

export interface RankableCandidate {
  userId: string;
  name: string;
  /** How capable they are of this specific service. */
  level: SkillLevel;
  /** Open tasks: todo, in progress or in review. */
  openTaskCount: number;
  /** Estimated hours still outstanding across those tasks. */
  estimatedHoursRemaining: number;
}

export interface RankedCandidate extends RankableCandidate {
  /** Why this person placed where they did, for the proposal's rationale. */
  reason: string;
}

/**
 * Capability first, then load.
 *
 * Capability leads because the wrong person doing the work quickly is worse
 * than the right person doing it a day later. Load breaks ties, so a capable
 * team does not funnel everything to whoever happens to be most senior.
 *
 * `estimatedHoursRemaining` is a third key rather than the primary load
 * measure: estimates are patchy in practice, and a count of open tasks is a
 * cruder but far more reliably populated signal. Name is the final tiebreak
 * purely so the ordering is deterministic — without it two identical
 * candidates could swap between calls and make the proposal look arbitrary.
 */
export function rankCandidates(candidates: RankableCandidate[]): RankedCandidate[] {
  return [...candidates]
    .sort((a, b) => {
      const byLevel = CAPABILITY_RANK[b.level] - CAPABILITY_RANK[a.level];
      if (byLevel !== 0) return byLevel;

      const byOpen = a.openTaskCount - b.openTaskCount;
      if (byOpen !== 0) return byOpen;

      const byHours = a.estimatedHoursRemaining - b.estimatedHoursRemaining;
      if (byHours !== 0) return byHours;

      return a.name.localeCompare(b.name);
    })
    .map((candidate) => ({
      ...candidate,
      reason: `${candidate.level} at this service · ${candidate.openTaskCount} open ${
        candidate.openTaskCount === 1 ? "task" : "tasks"
      }${
        candidate.estimatedHoursRemaining > 0
          ? ` · ${candidate.estimatedHoursRemaining}h outstanding`
          : ""
      }`,
    }));
}

/**
 * The rationale stored on the proposal.
 *
 * Deliberately records the runners-up too. "Why them" is only half the
 * question a branch head asks; the other half is "who else was considered",
 * and reconstructing that months later from load data that has since changed
 * is impossible.
 */
export function buildRationale(ranked: RankedCandidate[], serviceName: string | null) {
  const [chosen, ...rest] = ranked;
  if (!chosen) return null;
  return {
    chosen: { userId: chosen.userId, name: chosen.name, reason: chosen.reason },
    service: serviceName,
    consideredCount: ranked.length,
    runnersUp: rest.slice(0, 3).map((candidate) => ({
      name: candidate.name,
      reason: candidate.reason,
    })),
    decidedAt: null as string | null,
  };
}
