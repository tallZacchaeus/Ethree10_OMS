import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { requireAgencyAction } from "@/server/services/agency";
import { db } from "@/server/db/client";

export const sponsorshipsRouter = router({
  list: protectedProcedure
    .query(async ({ ctx }) => {
      await requireAgencyAction(ctx.userId, "workspace.read");
      return db.sponsorship.findMany({
        include: { project: true },
        orderBy: { createdAt: "desc" },
      });
    }),
    
  create: protectedProcedure
    .input(z.object({
      sponsorName: z.string().min(1),
      amount: z.number().min(0),
      currency: z.string().default("USD"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "workspace.read");
      return db.sponsorship.create({
        data: {
          sponsorName: input.sponsorName,
          amount: input.amount,
          currency: input.currency,
          status: "prospect",
        }
      });
    }),
});
