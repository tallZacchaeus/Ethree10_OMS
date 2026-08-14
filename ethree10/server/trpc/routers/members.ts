import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { Role, type SkillLevel } from "@prisma/client";
import { requireAgencyAction } from "@/server/services/agency";
import { NotificationService } from "@/server/services/notification";
import { NotificationAudience } from "@/server/services/notification-audience";
import { ROLE_LABELS } from "@/server/auth/role-groups";
import { assertRoleSetAllowed } from "@/server/auth/role-guard";

const skillLevelOrder: Record<SkillLevel, number> = {
  expert: 4,
  advanced: 3,
  intermediate: 2,
  beginner: 1,
};

export const membersRouter = router({
  positions: protectedProcedure.query(async ({ ctx }) => {
    await requireAgencyAction(ctx.userId, "member.read");
    return ctx.db.position.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { memberships: true } } } });
  }),

  createPosition: protectedProcedure
    .input(z.object({ name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "organization.invite");
      return ctx.db.position.create({ data: { name: input.name, description: input.description } });
    }),
  list: protectedProcedure
    .input(z.object({}).optional())
    .query(async ({ ctx }) => {
      await requireAgencyAction(ctx.userId, "member.read");
      const memberships = await ctx.db.membership.findMany({
        where: { removedAt: null },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            timezone: true,
            skills: { include: { skill: true } },
          },
        },
        team: { select: { id: true, name: true } },
        subUnit: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const userIds = memberships.map((m) => m.userId);
    const workloadRows = await ctx.db.task.groupBy({
      by: ["assigneeUserId"],
      where: {
        assigneeUserId: { in: userIds },
        status: { in: ["todo", "in_progress", "in_review"] },
      },
      _count: { _all: true },
    });
    const workload = new Map(
      workloadRows.map((r) => [r.assigneeUserId, r._count._all]),
    );

    return memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      title: m.title,
      team: m.team,
      subUnit: m.subUnit,
      user: m.user,
      openTaskCount: workload.get(m.userId) ?? 0,
    }));
  }),

  get: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "member.read");
      return ctx.db.user.findUnique({
        where: { id: input.userId },
        include: {
          skills: { include: { skill: true } },
          memberships: {
            where: { removedAt: null },
            include: { team: true, subUnit: true },
          },
        },
      });
    }),

  updateMembership: protectedProcedure
    .input(
      z.object({
        membershipId: z.string(),
        name: z.string().trim().min(1).max(120),
        role: z.nativeEnum(Role),
        title: z.string().trim().max(120).nullable(),
        teamId: z.string().nullable(),
        subUnitId: z.string().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "organization.changeRole");

      const membership = await ctx.db.membership.findFirst({
        where: { id: input.membershipId, removedAt: null },
        select: { userId: true },
      });
      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
      }

      // Separation of duties. This is the mutation the People screen calls, so
      // without this check the control was bypassable through normal admin use.
      await assertRoleSetAllowed(membership.userId, input.role, input.membershipId);

      if (input.subUnitId) {
        const subUnit = await ctx.db.subUnit.findFirst({
          where: {
            id: input.subUnitId,
            teamId: input.teamId ?? undefined,
            archivedAt: null,
          },
          select: { id: true },
        });
        if (!subUnit) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Choose a valid sub-unit for the selected team.",
          });
        }
      }

      const previous = await ctx.db.membership.findUnique({
        where: { id: input.membershipId },
        select: { role: true },
      });

      const updated = await ctx.db.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: membership.userId },
          data: { name: input.name },
        });
        return tx.membership.update({
          where: { id: input.membershipId },
          data: {
            role: input.role,
            title: input.title || null,
            teamId: input.teamId,
            subUnitId: input.subUnitId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatarUrl: true,
                timezone: true,
                skills: { include: { skill: true } },
              },
            },
            team: { select: { id: true, name: true } },
            subUnit: { select: { id: true, name: true } },
          },
        });
      });

      // Only on an actual role change. Renaming someone or moving them between
      // departments is not a permission event, and notifying on it would bury
      // the one message here that genuinely matters.
      if (previous && previous.role !== input.role) {
        await NotificationService.createMany(
          [
            ...NotificationAudience.subject(membership.userId, ctx.userId),
            ...(await NotificationAudience.administrators(ctx.userId)),
          ],
          {
            kind: "member_role_changed",
            title: `Role changed to ${ROLE_LABELS[input.role]}`,
            body: `${updated.user.name} is now ${ROLE_LABELS[input.role]} (was ${ROLE_LABELS[previous.role]}).`,
            link: "/members",
            entityType: "Membership",
            entityId: updated.id,
            allowDuplicate: true,
          },
        );
      }

      return updated;
    }),

  removeMembership: protectedProcedure
    .input(z.object({ membershipId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "organization.removeMember");
      const membership = await ctx.db.membership.findFirst({
        where: { id: input.membershipId, removedAt: null },
        select: { userId: true },
      });
      if (!membership) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Member not found." });
      }

      if (membership.userId === ctx.userId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove your own member access.",
        });
      }
      const removed = await ctx.db.membership.update({
        where: { id: input.membershipId },
        data: { removedAt: new Date() },
      });

      // The person losing access is told, and so are the administrators — a
      // membership disappearing with no record is how access disputes start.
      await NotificationService.createMany(
        [
          ...NotificationAudience.subject(membership.userId, ctx.userId),
          ...(await NotificationAudience.administrators(ctx.userId)),
        ],
        {
          kind: "member_removed",
          title: "Agency access removed",
          body: "A membership was removed. Speak to an Agency Admin if this is unexpected.",
          link: "/members",
          entityType: "Membership",
          entityId: removed.id,
          allowDuplicate: true,
        },
      );

      return removed;
    }),

  searchBySkill: protectedProcedure
    .input(z.object({ skillId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "member.read");
      const memberships = await ctx.db.membership.findMany({
        where: {
          removedAt: null,
          user: {
            skills: {
              some: { skillId: input.skillId },
            },
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
              skills: {
                where: { skillId: input.skillId },
                include: { skill: true },
              },
            },
          },
          team: { select: { name: true } },
        },
      });

      // Sort by skill level descending
      const sorted = memberships.sort((a, b) => {
        const aSkill = a.user.skills[0];
        const bSkill = b.user.skills[0];
        if (!aSkill) return 1;
        if (!bSkill) return -1;
        return skillLevelOrder[bSkill.level] - skillLevelOrder[aSkill.level];
      });

      return sorted.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        team: m.team?.name,
        level: m.user.skills[0]?.level,
        role: m.role,
      }));
    }),
});
