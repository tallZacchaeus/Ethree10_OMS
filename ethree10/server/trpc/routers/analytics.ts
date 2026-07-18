import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { requireAgencyAction } from "@/server/services/agency";
import { computeBottlenecks } from "@/server/services/analytics";
import { subMonths, startOfMonth, format } from "date-fns";

export const analyticsRouter = router({
  getAdvancedMetrics: protectedProcedure.query(async ({ ctx }) => {
    // Requires an agency role with organization.read (admin/executive/leads) or super_admin
    await requireAgencyAction(ctx.userId, "organization.read");

    // 1. 6-Month Throughput (Tasks Completed per month)
    const sixMonthsAgo = startOfMonth(subMonths(new Date(), 5));
    
    // Fetch all completed tasks in the last 6 months
    const tasks = await db.task.findMany({
      where: {
        status: "done",
        updatedAt: { gte: sixMonthsAgo },
      },
      select: { updatedAt: true },
    });

    const throughputData = Array.from({ length: 6 }).map((_, i) => {
      const d = subMonths(new Date(), 5 - i);
      return {
        month: format(d, "MMM"),
        completed: tasks.filter(t => t.updatedAt.getMonth() === d.getMonth()).length,
      };
    });

    // 2. Bottleneck Detection (avg days spent in each request stage).
    // Derived from real RequestStageEvent transitions: the gap between two
    // consecutive events is the dwell time in the earlier stage.
    const stageEvents = await db.requestStageEvent.findMany({
      select: { requestId: true, toStage: true, createdAt: true },
      orderBy: [{ requestId: "asc" }, { createdAt: "asc" }],
    });
    const bottleneckData = computeBottlenecks(stageEvents);

    return {
      throughput: throughputData,
      bottlenecks: bottleneckData,
    };
  }),
});
