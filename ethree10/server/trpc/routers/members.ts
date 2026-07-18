import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import type { SkillLevel } from "@prisma/client";
import { requireAgencyAction } from "@/server/services/agency";

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

  getAllSkills: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.skill.findMany({ orderBy: { name: "asc" } });
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
