import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { TimeLogService } from "@/server/services/timeLog";
import { TRPCError } from "@trpc/server";

export const timeLogsRouter = router({
  listForTask: protectedProcedure
    .input(z.string())
    .query(async ({ input }) => {
      return TimeLogService.listForTask(input);
    }),

  listForUser: protectedProcedure
    .input(z.object({ userId: z.string(), fromDate: z.date().optional(), toDate: z.date().optional() }))
    .query(async ({ input }) => {
      return TimeLogService.listForUser(input.userId, input.fromDate, input.toDate);
    }),

  add: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        hours: z.number().positive(),
        note: z.string().optional(),
        date: z.date(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return TimeLogService.addTimeLog({
        actorId: ctx.userId,
        taskId: input.taskId,
        hours: input.hours,
        note: input.note,
        date: input.date,
      });
    }),
});
