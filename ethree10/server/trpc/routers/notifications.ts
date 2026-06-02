import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { NotificationService } from "@/server/services/notification";

export const notificationsRouter = router({
  list: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      return NotificationService.list(ctx.userId, { unreadOnly: input?.unreadOnly });
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    return NotificationService.unreadCount(ctx.userId);
  }),

  markRead: protectedProcedure
    .input(z.object({ ids: z.array(z.string()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      await NotificationService.markRead(ctx.userId, input.ids);
      return { ok: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await NotificationService.markAllRead(ctx.userId);
    return { ok: true };
  }),
});
