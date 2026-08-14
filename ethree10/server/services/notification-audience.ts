import type { Role } from "@prisma/client";
import { db } from "@/server/db/client";
import {
  AGENCY_CONFIG_ROLES,
  AGENCY_WIDE_ROLES,
  FINANCE_ROLES,
} from "@/server/auth/role-groups";

/**
 * Who hears about what.
 *
 * Every notification needs a recipient list, and hand-rolling the membership
 * query at each call site is how the client-reply bug happened — that one
 * notified the routed branch head and nobody else, so a message during an
 * absence went unseen. Resolving audiences here means a role added to a named
 * group reaches every notification that group should receive.
 *
 * Each helper excludes the actor: telling someone what they just did is noise,
 * and it is the fastest way to train people to ignore the bell.
 */

function withoutActor(userIds: string[], actorId?: string | null): string[] {
  const unique = new Set(userIds.filter(Boolean));
  if (actorId) unique.delete(actorId);
  return Array.from(unique);
}

async function userIdsForRoles(roles: Role[]): Promise<string[]> {
  const memberships = await db.membership.findMany({
    where: { role: { in: roles }, removedAt: null, acceptedAt: { not: null } },
    select: { userId: true },
  });
  return memberships.map((m) => m.userId);
}

export const NotificationAudience = {
  /** Chief Executive, COO, Agency Admin, Finance — everyone with agency-wide sight. */
  async agencyWide(actorId?: string | null): Promise<string[]> {
    return withoutActor(await userIdsForRoles(AGENCY_WIDE_ROLES), actorId);
  },

  /** Leadership proper: the executive and the COO. Used for money and structure. */
  async executives(actorId?: string | null): Promise<string[]> {
    return withoutActor(
      await userIdsForRoles(["chief_executive", "chief_operating_officer"]),
      actorId,
    );
  },

  /** Whoever administers the agency — COO and Agency Admin. */
  async administrators(actorId?: string | null): Promise<string[]> {
    return withoutActor(await userIdsForRoles(AGENCY_CONFIG_ROLES), actorId);
  },

  /** Finance, for anything that moves or records money. */
  async finance(actorId?: string | null): Promise<string[]> {
    return withoutActor(await userIdsForRoles(FINANCE_ROLES), actorId);
  },

  /**
   * Money oversight: Finance plus the executives. Invoices, payments and
   * receipts matter to the people accountable for the numbers as well as the
   * people who move them.
   */
  async moneyOversight(actorId?: string | null): Promise<string[]> {
    const [finance, executives] = await Promise.all([
      userIdsForRoles(FINANCE_ROLES),
      userIdsForRoles(["chief_executive", "chief_operating_officer"]),
    ]);
    return withoutActor([...finance, ...executives], actorId);
  },

  /** The lead of a branch, if one is set. */
  async branchLead(teamId: string | null | undefined, actorId?: string | null): Promise<string[]> {
    if (!teamId) return [];
    const team = await db.team.findUnique({ where: { id: teamId }, select: { leadId: true } });
    return withoutActor(team?.leadId ? [team.leadId] : [], actorId);
  },

  /** The lead of a department, if one is set. */
  async departmentLead(
    subUnitId: string | null | undefined,
    actorId?: string | null,
  ): Promise<string[]> {
    if (!subUnitId) return [];
    const unit = await db.subUnit.findUnique({
      where: { id: subUnitId },
      select: { leadId: true },
    });
    return withoutActor(unit?.leadId ? [unit.leadId] : [], actorId);
  },

  /**
   * Everyone accountable for a project: its manager, the lead of the branch it
   * sits under, and the assignees of its open tasks.
   */
  async projectTeam(projectId: string, actorId?: string | null): Promise<string[]> {
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: {
        pmUserId: true,
        agencyTeamId: true,
        tasks: {
          where: { status: { notIn: ["done", "cancelled"] } },
          select: { assigneeUserId: true },
        },
      },
    });
    if (!project) return [];
    const team = project.agencyTeamId
      ? await db.team.findUnique({
          where: { id: project.agencyTeamId },
          select: { leadId: true },
        })
      : null;
    return withoutActor(
      [
        project.pmUserId,
        team?.leadId,
        ...project.tasks.map((t) => t.assigneeUserId),
      ].filter((id): id is string => Boolean(id)),
      actorId,
    );
  },

  /** A single user, when the event is about them (role changed, invited, …). */
  subject(userId: string | null | undefined, actorId?: string | null): string[] {
    return withoutActor(userId ? [userId] : [], actorId);
  },
};
