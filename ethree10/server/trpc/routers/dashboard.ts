import { router } from "../trpc";
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
    if (!can(agencyCtx, "organization.update")) return null;

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

    return {
      crossAgencyInbox,
      topProjects,
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
