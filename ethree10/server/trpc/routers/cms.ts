import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { superAdminProcedure } from "../procedures";

export const cmsRouter = router({
  get: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(async ({ ctx, input }) => {
      const entry = await ctx.db.marketingContent.findUnique({
        where: { key: input.key },
      });
      return entry;
    }),

  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.marketingContent.findMany({
      orderBy: { key: "asc" },
    });
  }),

  upsert: superAdminProcedure
    .input(
      z.object({
        key: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.marketingContent.upsert({
        where: { key: input.key },
        create: {
          key: input.key,
          content: input.content,
        },
        update: {
          content: input.content,
        },
      });
    }),
});
