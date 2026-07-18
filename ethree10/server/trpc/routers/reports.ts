import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { ReportService, weekBounds } from "@/server/services/report";
import { getAgencyAuthContext, requireAgencyAction } from "@/server/services/agency";
import { db } from "@/server/db/client";

const level = z.enum(["member", "subunit", "team", "agency", "organization"]);
const narrative = z.record(z.string(), z.string().max(5000));
const flatJson = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

async function visibleReportWhere(userId: string) {
  const auth = await getAgencyAuthContext(userId);
  if (auth.isSuperAdmin || auth.roles.includes("agency_admin") || auth.roles.includes("finance_admin")) return {};
  const memberships = await db.membership.findMany({
    where: { userId, removedAt: null, acceptedAt: { not: null } },
    select: { role: true, teamId: true },
  });
  const headedTeamIds = memberships.filter((item) => item.role === "team_head").flatMap((item) => item.teamId ? [item.teamId] : []);
  return { OR: [{ level: "member" as const, scopeId: userId }, { level: "team" as const, scopeId: { in: headedTeamIds } }] };
}

async function assertCanManage(userId: string, reportId: string) {
  const auth = await getAgencyAuthContext(userId);
  if (auth.isSuperAdmin || auth.roles.includes("agency_admin")) return;
  const report = await db.report.findUnique({ where: { id: reportId }, select: { level: true, scopeId: true } });
  if (!report) throw new TRPCError({ code: "NOT_FOUND" });
  if (report.level === "team") {
    const membership = await db.membership.findFirst({ where: { userId, role: "team_head", teamId: report.scopeId, removedAt: null, acceptedAt: { not: null } } });
    if (membership) return;
  }
  throw new TRPCError({ code: "FORBIDDEN" });
}

export const reportsRouter = router({
  myCurrentWeek: protectedProcedure.query(async ({ ctx }) => {
    const { periodStart, periodEnd } = weekBounds();
    return { periodStart, periodEnd, metrics: await ReportService.memberMetrics(ctx.userId, periodStart, periodEnd) };
  }),

  list: protectedProcedure
    .input(z.object({ level: level.optional(), scopeId: z.string().optional(), period: z.enum(["weekly", "monthly"]).optional() }).optional())
    .query(async ({ ctx, input }) => db.report.findMany({
      where: { ...(await visibleReportWhere(ctx.userId)), level: input?.level, scopeId: input?.scopeId, period: input?.period },
      orderBy: [{ periodStart: "desc" }, { level: "asc" }],
    })),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    const report = await db.report.findFirst({
      where: { id: input.id, ...(await visibleReportWhere(ctx.userId)) },
      include: { contributions: { orderBy: { occurredAt: "desc" } }, amendments: { orderBy: { createdAt: "desc" } } },
    });
    if (!report) throw new TRPCError({ code: "NOT_FOUND" });
    return report;
  }),

  generateWeekly: protectedProcedure.mutation(async ({ ctx }) => {
    await requireAgencyAction(ctx.userId, "report.generate");
    return ReportService.generateWeekly({ actorId: ctx.userId });
  }),

  generateMonthly: protectedProcedure.mutation(async ({ ctx }) => {
    await requireAgencyAction(ctx.userId, "report.generate");
    return ReportService.generateMonthly({ actorId: ctx.userId });
  }),

  updateNarrative: protectedProcedure.input(z.object({ id: z.string(), narrative })).mutation(async ({ ctx, input }) => {
    await assertCanManage(ctx.userId, input.id);
    return ReportService.updateNarrative({ reportId: input.id, actorId: ctx.userId, narrative: input.narrative });
  }),

  finalize: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    await assertCanManage(ctx.userId, input.id);
    return ReportService.finalize({ reportId: input.id, actorId: ctx.userId });
  }),

  amend: protectedProcedure.input(z.object({ id: z.string(), reason: z.string().trim().min(5).max(1000), metrics: flatJson, narrative })).mutation(async ({ ctx, input }) => {
    await assertCanManage(ctx.userId, input.id);
    return ReportService.amend({ reportId: input.id, actorId: ctx.userId, reason: input.reason, metrics: input.metrics, narrative: input.narrative });
  }),
});
