import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SkillLevel } from "@prisma/client";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { requireAgencyAction } from "@/server/services/agency";

/**
 * The skill taxonomy, and the skills recorded against each person.
 *
 * These are not decoration: `server/services/task.ts` matches a task's needs
 * against `User.skills` when it suggests an assignee. Before this router the
 * taxonomy could only be changed by seeding the database, so the suggester was
 * working from whatever the seed happened to contain.
 */
export const skillsRouter = router({
  // Everyone who can see people can see the skill list — it drives filters and
  // the assignee picker, both of which are read surfaces.
  list: protectedProcedure.query(async ({ ctx }) => {
    await requireAgencyAction(ctx.userId, "member.read");
    const skills = await ctx.db.skill.findMany({
      orderBy: [{ category: "asc" }, { name: "asc" }],
      include: { _count: { select: { users: true } } },
    });
    return skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      category: skill.category,
      peopleCount: skill._count.users,
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().trim().min(2).max(60),
        category: z.string().trim().max(60).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "skill.manage");
      const existing = await ctx.db.skill.findFirst({
        where: { name: { equals: input.name, mode: "insensitive" } },
        select: { name: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${existing.name}" already exists.`,
        });
      }
      return ctx.db.skill.create({
        data: { name: input.name, category: input.category || null },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().trim().min(2).max(60),
        category: z.string().trim().max(60).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "skill.manage");
      const clash = await ctx.db.skill.findFirst({
        where: {
          id: { not: input.id },
          name: { equals: input.name, mode: "insensitive" },
        },
        select: { name: true },
      });
      if (clash) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `"${clash.name}" already exists.`,
        });
      }
      return ctx.db.skill.update({
        where: { id: input.id },
        data: { name: input.name, category: input.category || null },
      });
    }),

  /**
   * Delete a skill. `UserSkill` cascades, so deleting one that people hold
   * silently strips it from their profiles and from assignee suggestions. That
   * needs to be a deliberate choice, not a side effect — hence `force`.
   */
  remove: protectedProcedure
    .input(z.object({ id: z.string(), force: z.boolean().default(false) }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "skill.manage");
      const skill = await ctx.db.skill.findUnique({
        where: { id: input.id },
        select: { name: true, _count: { select: { users: true } } },
      });
      if (!skill) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Skill not found." });
      }
      const inUse = skill._count.users;
      if (inUse > 0 && !input.force) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${skill.name} is recorded against ${inUse} ${
            inUse === 1 ? "person" : "people"
          }. Deleting it removes it from their profiles.`,
        });
      }
      await ctx.db.skill.delete({ where: { id: input.id } });
      return { removedFrom: inUse };
    }),

  /** The skills recorded against one person. */
  forUser: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "member.read");
      const rows = await ctx.db.userSkill.findMany({
        where: { userId: input.userId },
        include: { skill: { select: { id: true, name: true, category: true } } },
        orderBy: { skill: { name: "asc" } },
      });
      return rows.map((row) => ({
        skillId: row.skillId,
        name: row.skill.name,
        category: row.skill.category,
        level: row.level,
      }));
    }),

  /**
   * Replace a person's whole skill set. Leads may set anyone's; everyone may
   * set their own, so keeping a profile current never needs an admin.
   */
  setForUser: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        skills: z
          .array(
            z.object({
              skillId: z.string(),
              level: z.nativeEnum(SkillLevel).default("intermediate"),
            }),
          )
          .max(40),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId !== ctx.userId) {
        await requireAgencyAction(ctx.userId, "member.updateSkills");
      }

      const ids = input.skills.map((skill) => skill.skillId);
      if (new Set(ids).size !== ids.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The same skill was listed twice.",
        });
      }
      const known = await ctx.db.skill.count({ where: { id: { in: ids } } });
      if (known !== ids.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One of those skills no longer exists. Reload and try again.",
        });
      }

      await ctx.db.$transaction([
        ctx.db.userSkill.deleteMany({ where: { userId: input.userId } }),
        ctx.db.userSkill.createMany({
          data: input.skills.map((skill) => ({
            userId: input.userId,
            skillId: skill.skillId,
            level: skill.level,
          })),
        }),
      ]);

      return { count: input.skills.length };
    }),
});
