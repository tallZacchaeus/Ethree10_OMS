import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { NotificationKind } from "@prisma/client";

export const preferencesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.notificationPreference.findMany({
      where: { userId: ctx.userId },
    });
  }),

  update: protectedProcedure
    .input(
      z.object({
        kind: z.nativeEnum(NotificationKind),
        email: z.boolean().optional(),
        push: z.boolean().optional(),
        whatsapp: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { kind, ...data } = input;
      
      return db.notificationPreference.upsert({
        where: {
          userId_kind: { userId: ctx.userId, kind },
        },
        update: data,
        create: {
          userId: ctx.userId,
          kind,
          email: data.email ?? true,
          push: data.push ?? true,
          whatsapp: data.whatsapp ?? false,
        },
      });
    }),
});
