import { router } from "../trpc";
import { hasAgencyWideScope } from "@/server/auth/role-groups";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { getAgencyAuthContext } from "@/server/services/agency";
import { can } from "@/server/auth/permissions";



export const dashboardRouter = router({
  // Team heads receive a team-scoped operational rollup.

  teamLead: protectedProcedure.query(async ({ ctx }) => {
    const agencyCtx = await getAgencyAuthContext(ctx.userId);
    if (!can(agencyCtx, "project.update")) return null;

    const myTeams = await db.team.findMany({
      where: { leadId: ctx.userId },
      select: { id: true, name: true },
    });

    if (myTeams.length === 0) return null;
    const teamIds = myTeams.map((team) => team.id);
    const now = new Date();

    const incomingRequests = await db.request.findMany({
      where: {
        routedTeamId: { in: teamIds },
        stage: { in: ["pending_approval", "under_review", "scoping", "proposal"] },
      },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
      take: 10,
      include: {
        organization: { select: { id: true, name: true } },
      },
    });

    const activeProjects = await db.project.count({
      where: {
        agencyTeamId: { in: teamIds },
        status: { in: ["active", "in_review", "on_hold"] },
      },
    });

    const deliveredAwaitingFeedback = await db.project.count({
      where: {
        agencyTeamId: { in: teamIds },
        status: "delivered",
      },
    });

    const overdueTasksCount = await db.task.count({
      where: {
        project: { agencyTeamId: { in: teamIds } },
        status: { notIn: ["done", "cancelled"] },
        dueDate: { lt: now },
      },
    });

    const kpiSnapshot = await db.kpiSnapshot.findFirst({
      where: {
        level: "team",
        scopeId: { in: teamIds },
      },
      orderBy: { periodStart: "desc" },
    });

    return {
      teams: myTeams,
      incomingRequests,
      metrics: {
        activeProjects,
        deliveredAwaitingFeedback,
        overdueTasksCount,
      },
      kpiSnapshot,
    };
  }),

  agencyLead: protectedProcedure.query(async ({ ctx }) => {
    const agencyCtx = await getAgencyAuthContext(ctx.userId);
    // Gate on agency-wide READ scope, not on `organization.update`. This is an
    // overview surface: the Chief Executive and Finance are read-only by design
    // and would otherwise get an empty dashboard.
    if (!hasAgencyWideScope(agencyCtx)) return null;

    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - 30);

    const crossAgencyInbox = await db.request.findMany({
      where: { stage: { in: ["submitted", "pending_approval", "under_review", "scoping", "proposal"] } },
      orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
      take: 10,
      include: {
        routedTeam: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });

    const topProjects = await db.project.findMany({
      where: { status: { in: ["active", "in_review", "on_hold"] } },
      orderBy: [{ targetDeliveryDate: "asc" }, { updatedAt: "desc" }],
      take: 6,
      include: {
        team: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });

    const [
      pendingApprovals,
      overdueTasksCount,
      activeProjectsCount,
      deliveredProjectsAwaitingFeedback,
      completedTasksLast7Days,
      deliveredProjectsLast30Days,
      closedRequestsLast30Days,
      activeTasks,
    ] = await Promise.all([
      db.request.count({ where: { stage: "pending_approval" } }),
      db.task.count({
        where: {
          status: { notIn: ["done", "cancelled"] },
          dueDate: { lt: now },
        },
      }),
      db.project.count({ where: { status: { in: ["active", "in_review", "on_hold"] } } }),
      db.project.count({ where: { status: "delivered" } }),
      db.task.count({
        where: {
          status: "done",
          completedAt: { gte: sevenDaysAgo },
        },
      }),
      db.project.count({
        where: {
          actualDeliveryDate: { gte: thirtyDaysAgo },
        },
      }),
      db.request.count({
        where: {
          stage: "closed",
          updatedAt: { gte: thirtyDaysAgo },
        },
      }),
      db.task.findMany({
        where: {
          status: { notIn: ["done", "cancelled"] },
        },
        select: { estimatedHours: true, loggedHours: true },
      }),
    ]);

    const totalRemainingHours = activeTasks.reduce((sum, task) => {
      const estimate = task.estimatedHours ? Number(task.estimatedHours) : 0;
      const logged = task.loggedHours ? Number(task.loggedHours) : 0;
      return sum + Math.max(0, estimate - logged);
    }, 0);

    const agencyMemberships = await db.membership.findMany({
      where: {
        removedAt: null,
        acceptedAt: { not: null },
      },
      include: { user: { select: { workingHoursPerWeek: true } } },
    });

    const totalWeeklyCapacity = agencyMemberships.reduce(
      (sum, membership) => sum + (membership.user.workingHoursPerWeek || 40),
      0,
    );

    // The three success measures from the vision document (§1.7), computed from
    // real data rather than left in a document nobody opens:
    //   · every request flows through the platform
    //   · average triage time under 48 hours
    //   · client satisfaction 4+ out of 5
    const [triaged, csatScores, unroutedCount] = await Promise.all([
      db.request.findMany({
        where: { routedTeamId: { not: null }, createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true, stageEvents: { where: { toStage: "under_review" }, orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } } },
        take: 200,
      }),
      db.project.findMany({
        where: { csatScore: { not: null }, updatedAt: { gte: thirtyDaysAgo } },
        select: { csatScore: true },
      }),
      db.request.count({ where: { routedTeamId: null, stage: { in: ["submitted", "needs_clarification"] } } }),
    ]);

    const triageHours = triaged.flatMap((request) => {
      const first = request.stageEvents[0];
      if (!first) return [];
      return [(first.createdAt.getTime() - request.createdAt.getTime()) / 3_600_000];
    });
    const averageTriageHours = triageHours.length
      ? Number((triageHours.reduce((a, b) => a + b, 0) / triageHours.length).toFixed(1))
      : null;
    const averageCsat = csatScores.length
      ? Number(
          (csatScores.reduce((sum, p) => sum + (p.csatScore ?? 0), 0) / csatScores.length).toFixed(1),
        )
      : null;

    return {
      crossAgencyInbox,
      topProjects,
      successMetrics: {
        averageTriageHours,
        triageTargetHours: 48,
        averageCsat,
        csatTarget: 4,
        awaitingTriage: unroutedCount,
      },
      metrics: {
        pendingApprovals,
        overdueTasksCount,
        activeProjectsCount,
        deliveredProjectsAwaitingFeedback,
        completedTasksLast7Days,
        deliveredProjectsLast30Days,
        closedRequestsLast30Days,
      },
      capacity: {
        totalRemainingHours,
        totalWeeklyCapacity,
        loadRatio:
          totalWeeklyCapacity > 0 ? Number((totalRemainingHours / totalWeeklyCapacity).toFixed(2)) : null,
      },
    };
  }),


});
