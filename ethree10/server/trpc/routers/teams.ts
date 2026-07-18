import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const teamsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await ctx.authorize("team.read");
    return ctx.db.team.findMany({
      where: { archivedAt: null },
      include: { subUnits: { where: { archivedAt: null } } },
      orderBy: { name: "asc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.authorize("team.read");
      const team = await ctx.db.team.findFirst({
        where: { id: input.id },
        include: { subUnits: true },
      });
      if (!team) throw new TRPCError({ code: "NOT_FOUND" });
      return team;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
        description: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("team.create");
      return ctx.db.team.create({
        data: {
          name: input.name,
          slug: slugify(input.name),
          description: input.description,
          color: input.color,
          icon: input.icon,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        icon: z.string().optional(),
        leadId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const authCtx = await ctx.authorize("team.update");
      if (!authCtx.isSuperAdmin && !authCtx.roles.includes("agency_admin")) {
        if (authCtx.teamId !== input.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Cannot update a team you do not head." });
        }
      }
      const { id, ...data } = input;
      return ctx.db.team.update({ where: { id }, data });
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("team.archive");
      return ctx.db.team.update({
        where: { id: input.id },
        data: { archivedAt: new Date() },
      });
    }),
});
