import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { ReportService, weekBounds } from "@/server/services/report";
import { getAgencyAuthContext, requireAgencyAction } from "@/server/services/agency";
import { can } from "@/server/auth/permissions";

export const reportsRouter = router({
  myCurrentWeek: protectedProcedure.query(async ({ ctx }) => {
    const { periodStart, periodEnd } = weekBounds();
    const metrics = await ReportService.memberMetrics(ctx.userId, periodStart, periodEnd);
    return { periodStart, periodEnd, metrics };
  }),

  list: protectedProcedure
    .input(
      z
        .object({
          level: z.enum(["member", "subunit", "department", "agency"]).optional(),
          scopeId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      if (can(agencyCtx, "report.read")) {
        return ReportService.list({ level: input?.level, scopeId: input?.scopeId });
      }
      // Members only see their own member-level reports.
      return ReportService.list({ level: "member", scopeId: ctx.userId });
    }),

  generateWeekly: protectedProcedure.mutation(async ({ ctx }) => {
    await requireAgencyAction(ctx.userId, "report.generate");
    return ReportService.generateWeekly({ actorId: ctx.userId });
  }),
});
