import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { workspaceProcedure } from "../procedures";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const subunitsRouter = router({
  list: workspaceProcedure
    .input(z.object({ departmentId: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.authorize("subunit.read");
      return ctx.db.subUnit.findMany({
        where: { departmentId: input.departmentId, archivedAt: null },
        orderBy: { name: "asc" },
      });
    }),

  create: workspaceProcedure
    .input(
      z.object({
        departmentId: z.string(),
        name: z.string().min(2),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("subunit.create");
      const dept = await ctx.db.department.findFirst({
        where: { id: input.departmentId, workspaceId: ctx.workspaceId },
      });
      if (!dept) throw new TRPCError({ code: "NOT_FOUND" });
      return ctx.db.subUnit.create({
        data: {
          departmentId: input.departmentId,
          name: input.name,
          slug: slugify(input.name),
          description: input.description,
        },
      });
    }),

  update: workspaceProcedure
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

  archive: workspaceProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("subunit.archive");
      return ctx.db.subUnit.update({
        where: { id: input.id },
        data: { archivedAt: new Date() },
      });
    }),
});
