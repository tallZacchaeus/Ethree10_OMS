import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { getAgencyAuthContext } from "@/server/services/agency";
import { can } from "@/server/auth/permissions";

const REQUESTER_ROLES = ["requester_admin", "requester_member", "requester_observer"] as const;

export const dashboardRouter = router({
  subUnitLead: protectedProcedure.query(async ({ ctx }) => {
    const agencyCtx = await getAgencyAuthContext(ctx.userId);
    if (!can(agencyCtx, "task.review")) return null;

    const mySubUnits = await db.subUnit.findMany({
      where: { leadId: ctx.userId },
      select: { id: true, name: true },
    });

    if (mySubUnits.length === 0) return null;
    const subUnitIds = mySubUnits.map((subUnit) => subUnit.id);
    const now = new Date();

    const reviewQueue = await db.task.findMany({
      where: {
        subUnitId: { in: subUnitIds },
        status: "in_review",
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    const activeTasks = await db.task.findMany({
      where: {
        subUnitId: { in: subUnitIds },
        status: { notIn: ["done", "cancelled"] },
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
    });

    const overdueTasksCount = activeTasks.filter(
      (task) => task.dueDate && task.dueDate < now && task.status !== "in_review",
    ).length;

    return {
      reviewQueue,
      activeTasks,
      overdueTasksCount,
      subUnits: mySubUnits,
    };
  }),

  departmentLead: protectedProcedure.query(async ({ ctx }) => {
    const agencyCtx = await getAgencyAuthContext(ctx.userId);
    if (!can(agencyCtx, "project.update")) return null;

    const myDepartments = await db.department.findMany({
      where: { leadId: ctx.userId },
      select: { id: true, name: true },
    });

    if (myDepartments.length === 0) return null;
    const departmentIds = myDepartments.map((department) => department.id);
    const now = new Date();

    const incomingRequests = await db.request.findMany({
      where: {
        routedDepartmentId: { in: departmentIds },
        stage: { in: ["pending_approval", "under_review", "scoping", "proposal"] },
      },
      orderBy: [{ urgency: "desc" }, { createdAt: "desc" }],
      take: 10,
      include: {
        workspace: { select: { id: true, name: true } },
      },
    });

    const activeProjects = await db.project.count({
      where: {
        agencyDepartmentId: { in: departmentIds },
        status: { in: ["active", "in_review", "on_hold"] },
      },
    });

    const deliveredAwaitingFeedback = await db.project.count({
      where: {
        agencyDepartmentId: { in: departmentIds },
        status: "delivered",
      },
    });

    const overdueTasksCount = await db.task.count({
      where: {
        project: { agencyDepartmentId: { in: departmentIds } },
        status: { notIn: ["done", "cancelled"] },
        dueDate: { lt: now },
      },
    });

    const kpiSnapshot = await db.kpiSnapshot.findFirst({
      where: {
        level: "department",
        scopeId: { in: departmentIds },
      },
      orderBy: { periodStart: "desc" },
    });

    return {
      departments: myDepartments,
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
    if (!can(agencyCtx, "workspace.update")) return null;

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
        routedDepartment: { select: { name: true } },
        workspace: { select: { name: true } },
      },
    });

    const topProjects = await db.project.findMany({
      where: { status: { in: ["active", "in_review", "on_hold"] } },
      orderBy: [{ targetDeliveryDate: "asc" }, { updatedAt: "desc" }],
      take: 6,
      include: {
        department: { select: { name: true } },
        workspace: { select: { name: true } },
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

    const agencyWorkspace = await db.workspace.findFirst({ where: { type: "agency" } });
    let totalWeeklyCapacity = 0;

    if (agencyWorkspace) {
      const agencyMemberships = await db.membership.findMany({
        where: {
          workspaceId: agencyWorkspace.id,
          removedAt: null,
          acceptedAt: { not: null },
        },
        include: { user: { select: { workingHoursPerWeek: true } } },
      });

      totalWeeklyCapacity = agencyMemberships.reduce(
        (sum, membership) => sum + (membership.user.workingHoursPerWeek || 40),
        0,
      );
    }

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

  requester: protectedProcedure.query(async ({ ctx }) => {
    const requesterMemberships = await db.membership.findMany({
      where: {
        userId: ctx.userId,
        role: { in: [...REQUESTER_ROLES] },
        removedAt: null,
        acceptedAt: { not: null },
      },
      select: {
        workspaceId: true,
        workspace: { select: { id: true, name: true } },
      },
    });

    if (requesterMemberships.length === 0) return null;
    const workspaceIds = requesterMemberships.map((membership) => membership.workspaceId);

    const [recentRequests, activeProjects, awaitingFeedback, openRequestsCount, activeProjectsCount] =
      await Promise.all([
        db.request.findMany({
          where: { workspaceId: { in: workspaceIds } },
          orderBy: { updatedAt: "desc" },
          take: 6,
          include: {
            project: { select: { id: true, code: true, status: true } },
            workspace: { select: { id: true, name: true } },
          },
        }),
        db.project.findMany({
          where: {
            workspaceId: { in: workspaceIds },
            status: { in: ["active", "in_review", "on_hold"] },
          },
          orderBy: [{ targetDeliveryDate: "asc" }, { updatedAt: "desc" }],
          take: 6,
          include: {
            workspace: { select: { id: true, name: true } },
            department: { select: { name: true } },
            request: { select: { id: true } },
          },
        }),
        db.project.findMany({
          where: {
            workspaceId: { in: workspaceIds },
            status: "delivered",
          },
          orderBy: { updatedAt: "desc" },
          take: 6,
          include: {
            workspace: { select: { id: true, name: true } },
            request: { select: { id: true } },
          },
        }),
        db.request.count({
          where: {
            workspaceId: { in: workspaceIds },
            stage: { notIn: ["closed", "rejected", "cancelled"] },
          },
        }),
        db.project.count({
          where: {
            workspaceId: { in: workspaceIds },
            status: { in: ["active", "in_review", "on_hold"] },
          },
        }),
      ]);

    return {
      workspaces: requesterMemberships.map((membership) => membership.workspace),
      recentRequests,
      activeProjects,
      awaitingFeedback,
      metrics: {
        openRequestsCount,
        activeProjectsCount,
        awaitingFeedbackCount: awaitingFeedback.length,
      },
    };
  }),
});
