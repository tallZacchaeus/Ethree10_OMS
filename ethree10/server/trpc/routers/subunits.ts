import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const subunitsRouter = router({
  list: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.authorize("subunit.read");
      return ctx.db.subUnit.findMany({
        where: { teamId: input.teamId, archivedAt: null },
        orderBy: { name: "asc" },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        teamId: z.string(),
        name: z.string().min(2),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("subunit.create");
      const dept = await ctx.db.team.findFirst({
        where: { id: input.teamId },
      });
      if (!dept) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.subUnit.create({
        data: {
          teamId: input.teamId,
          name: input.name,
          slug: slugify(input.name),
          description: input.description,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        leadId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("subunit.update");
      const { id, ...data } = input;
      return ctx.db.subUnit.update({ where: { id }, data });
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("subunit.archive");
      return ctx.db.subUnit.update({
        where: { id: input.id },
        data: { archivedAt: new Date() },
      });
    }),
});
