import type { Role } from "@prisma/client";

/**
 * Whether a person may be given a task on a particular branch.
 *
 * A pure function on purpose. The rule is the valuable part and it needs to be
 * exhaustively testable without a database — `tests/unit/` runs in CI, the
 * integration suite does not, so a rule that could only be tested against a live
 * database would effectively be untested on every pull request.
 *
 * Context: `TaskService.assign` previously validated nothing at all. It wrote
 * `assigneeUserId` straight to the task without checking the assignee was in the
 * branch, in the department, or even on staff — and there is no foreign key on
 * that column either, so any string was accepted. The picker only ever *showed*
 * a narrow list; the constraint was presentation, never enforcement.
 */

export interface AssigneeMembership {
  role: Role;
  /** The branch this membership belongs to, or null for agency-wide roles. */
  teamId: string | null;
}

export interface AssignmentEligibilityInput {
  /** The assignee's active, accepted memberships. */
  memberships: AssigneeMembership[];
  isSuperAdmin: boolean;
  /** Branch the task's project belongs to, or null if it has not been routed. */
  projectTeamId: string | null;
}

export type AssignmentEligibility =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * The rule, and why it is not simply "must be a member of this branch".
 *
 * Agency-wide roles — Agency Admin, COO, Chief Executive, Finance — hold no
 * branch at all; their memberships carry a null `teamId`. The sidebar already
 * lists Agency Admin as delivery staff and shows them "My Work", so the app
 * expects them to be able to hold tasks. A branch-only rule would contradict
 * that and make them permanently unassignable.
 *
 * So the rule is: someone who *belongs to branches* may only be given work in
 * one of their own. Someone who belongs to none is not confined by branch.
 *
 * That still closes the hole this exists for — a Digital Media team member can
 * no longer be handed Tech & Product work, and a non-member cannot be handed
 * anything at all.
 */
export function checkAssignmentEligibility(
  input: AssignmentEligibilityInput,
): AssignmentEligibility {
  // The documented technical escape hatch. `can()` short-circuits on this
  // everywhere else; assignment should not be the one place it does not.
  if (input.isSuperAdmin) return { ok: true };

  if (input.memberships.length === 0) {
    return {
      ok: false,
      reason: "That person is not an active member of the agency, so work cannot be assigned to them.",
    };
  }

  // An unrouted project has no branch to check against. Requiring routing first
  // would be defensible, but assignment is a far more common operation than
  // setting contributors and refusing here would block ordinary work over a
  // condition the assigner may not control. Staff membership is still required.
  if (!input.projectTeamId) return { ok: true };

  const branchIds = input.memberships
    .map((membership) => membership.teamId)
    .filter((teamId): teamId is string => Boolean(teamId));

  // Belongs to no branch: an agency-wide role, or staff not yet placed. Not
  // confined by branch, so nothing to contradict here.
  if (branchIds.length === 0) return { ok: true };

  if (!branchIds.includes(input.projectTeamId)) {
    return {
      ok: false,
      reason:
        "That person belongs to a different branch. Assign someone from the branch that owns this project, " +
        "or add them as a contributor if the work genuinely spans both.",
    };
  }

  return { ok: true };
}
