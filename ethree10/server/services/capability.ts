import { TRPCError } from "@trpc/server";
import type { SkillLevel } from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { requireAgencyAction } from "@/server/services/agency";

/**
 * Who can deliver which service.
 *
 * Skills record what a person *knows*; capability records what they are
 * *cleared to deliver*. Keeping them separate matters: someone can know Figma
 * without being the person the agency puts on client-facing UI work, and a lead
 * needs to be able to say so. `suggestFromSkills` bridges the two without
 * conflating them — it proposes, a lead decides.
 *
 * Step 2 of docs/service-assignment-plan.md. Nothing here changes assignment
 * behaviour yet; it builds the record that steps 3 and 4 rank against.
 */

/** Ordering for ranking. Higher is more capable. */
export const CAPABILITY_RANK: Record<SkillLevel, number> = {
  beginner: 1,
  intermediate: 2,
  advanced: 3,
  expert: 4,
};

export class CapabilityService {
  /** Everyone cleared to deliver a service, most capable first. */
  static async forService(serviceId: string) {
    const rows = await db.serviceCapability.findMany({
      where: { serviceId, revokedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            deactivatedAt: true,
            memberships: {
              where: { removedAt: null, acceptedAt: { not: null } },
              select: { role: true, teamId: true, subUnitId: true },
            },
          },
        },
      },
    });

    // Deactivated accounts keep their row — the record of who was cleared is
    // history — but they are never offered as a candidate.
    return rows
      .filter((row) => !row.user.deactivatedAt)
      .sort((a, b) => CAPABILITY_RANK[b.level] - CAPABILITY_RANK[a.level]);
  }

  /** Every service one person is cleared to deliver. */
  static async forUser(userId: string) {
    return db.serviceCapability.findMany({
      where: { userId, revokedAt: null },
      include: { service: { select: { id: true, name: true, slug: true, teamId: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * The whole matrix for a branch, including services nobody can deliver.
   *
   * The gaps are the point. A service with no capable person is a staffing fact
   * worth seeing before a request for it arrives, not after.
   */
  static async matrixForBranch(teamId: string | null) {
    const services = await db.service.findMany({
      where: { isActive: true, ...(teamId ? { teamId } : {}) },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, teamId: true },
    });

    const capabilities = await db.serviceCapability.findMany({
      where: { serviceId: { in: services.map((s) => s.id) }, revokedAt: null },
      include: { user: { select: { id: true, name: true, deactivatedAt: true } } },
    });

    return services.map((service) => {
      const people = capabilities
        .filter((c) => c.serviceId === service.id && !c.user.deactivatedAt)
        .map((c) => ({ userId: c.user.id, name: c.user.name, level: c.level }))
        .sort((a, b) => CAPABILITY_RANK[b.level] - CAPABILITY_RANK[a.level]);
      return { service, people, uncovered: people.length === 0 };
    });
  }

  /** Record that someone can deliver a service. */
  static async grant(args: {
    actorId: string;
    userId: string;
    serviceId: string;
    level?: SkillLevel;
  }) {
    await requireAgencyAction(args.actorId, "member.updateSkills");

    const [user, service] = await Promise.all([
      db.user.findUnique({
        where: { id: args.userId },
        select: {
          deactivatedAt: true,
          memberships: { where: { removedAt: null, acceptedAt: { not: null } }, select: { id: true } },
        },
      }),
      db.service.findUnique({ where: { id: args.serviceId }, select: { isActive: true } }),
    ]);

    if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "That user does not exist." });
    if (user.deactivatedAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "That account is deactivated." });
    }
    if (user.memberships.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "That person holds no agency role, so they cannot be cleared to deliver work.",
      });
    }
    if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "That service does not exist." });
    if (!service.isActive) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "That service is not active." });
    }

    // Upsert on the unique pair so re-granting a revoked capability restores the
    // original row rather than leaving a dead one behind.
    const capability = await db.serviceCapability.upsert({
      where: { userId_serviceId: { userId: args.userId, serviceId: args.serviceId } },
      update: { level: args.level ?? "intermediate", revokedAt: null, grantedById: args.actorId },
      create: {
        userId: args.userId,
        serviceId: args.serviceId,
        level: args.level ?? "intermediate",
        grantedById: args.actorId,
      },
    });

    await AuditService.log({
      actorId: args.actorId,
      action: "capability.granted",
      entityType: "ServiceCapability",
      entityId: capability.id,
      after: { userId: args.userId, serviceId: args.serviceId, level: capability.level },
    });

    return capability;
  }

  /** Withdraw it. The row is kept so past assignments stay explicable. */
  static async revoke(args: { actorId: string; userId: string; serviceId: string }) {
    await requireAgencyAction(args.actorId, "member.updateSkills");

    const existing = await db.serviceCapability.findUnique({
      where: { userId_serviceId: { userId: args.userId, serviceId: args.serviceId } },
    });
    if (!existing || existing.revokedAt) {
      throw new TRPCError({ code: "NOT_FOUND", message: "That capability is not on record." });
    }

    const updated = await db.serviceCapability.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    await AuditService.log({
      actorId: args.actorId,
      action: "capability.revoked",
      entityType: "ServiceCapability",
      entityId: updated.id,
      before: { revokedAt: null },
      after: { revokedAt: updated.revokedAt?.toISOString(), userId: args.userId },
    });

    return updated;
  }

  /**
   * Propose capabilities from the skills people already have.
   *
   * Suggestion only — nothing is written. Asking leads to fill a blank matrix of
   * every person against every service is how a feature like this gets abandoned
   * half-complete; starting from what the skills data already implies makes the
   * first pass a review rather than data entry.
   *
   * Matching is deliberately simple: a service is suggested when one of its
   * words appears in a skill name. It will miss things and occasionally
   * over-reach, which is fine — a human confirms each one.
   */
  static async suggestFromSkills(serviceId: string) {
    const service = await db.service.findUnique({
      where: { id: serviceId },
      select: { id: true, name: true, teamId: true },
    });
    if (!service) throw new TRPCError({ code: "NOT_FOUND", message: "That service does not exist." });

    const words = service.name
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((word) => word.length > 3);

    const candidates = await db.user.findMany({
      where: {
        deactivatedAt: null,
        memberships: {
          some: {
            removedAt: null,
            acceptedAt: { not: null },
            ...(service.teamId ? { teamId: service.teamId } : {}),
          },
        },
      },
      select: {
        id: true,
        name: true,
        skills: { select: { level: true, skill: { select: { name: true } } } },
        serviceCapabilities: { where: { serviceId, revokedAt: null }, select: { id: true } },
      },
    });

    return candidates
      // Anyone already cleared is not a suggestion.
      .filter((user) => user.serviceCapabilities.length === 0)
      .map((user) => {
        const matched = user.skills.filter((entry) =>
          words.some((word) => entry.skill.name.toLowerCase().includes(word)),
        );
        return {
          userId: user.id,
          name: user.name,
          matchedSkills: matched.map((entry) => entry.skill.name),
          // Lead with the strongest matching skill, so the level offered is the
          // one they actually demonstrate rather than a flat default.
          suggestedLevel:
            matched.sort((a, b) => CAPABILITY_RANK[b.level] - CAPABILITY_RANK[a.level])[0]?.level ??
            ("intermediate" as SkillLevel),
        };
      })
      .filter((suggestion) => suggestion.matchedSkills.length > 0);
  }
}
