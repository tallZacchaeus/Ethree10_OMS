import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const departmentsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await ctx.authorize("department.read");
    return ctx.db.department.findMany({
      where: { archivedAt: null },
      include: { subUnits: { where: { archivedAt: null } } },
      orderBy: { name: "asc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.authorize("department.read");
      const dept = await ctx.db.department.findFirst({
        where: { id: input.id },
        include: { subUnits: true },
      });
      if (!dept) throw new TRPCError({ code: "NOT_FOUND" });
      return dept;
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
      await ctx.authorize("department.create");
      return ctx.db.department.create({
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
      await ctx.authorize("department.update");
      const { id, ...data } = input;
      return ctx.db.department.update({ where: { id }, data });
    }),

  archive: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("department.archive");
      return ctx.db.department.update({
        where: { id: input.id },
        data: { archivedAt: new Date() },
      });
    }),
});
