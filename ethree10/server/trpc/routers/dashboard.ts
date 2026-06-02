import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { getAgencyAuthContext, requireAgencyAction } from "@/server/services/agency";
import { can } from "@/server/auth/permissions";

export const dashboardRouter = router({
  subUnitLead: protectedProcedure.query(async ({ ctx }) => {
    // Only available to sub-unit leads or above
    const agencyCtx = await getAgencyAuthContext(ctx.userId);
    if (!can(agencyCtx, "task.review")) return null;

    // Get sub-units this user leads
    const mySubUnits = await db.subUnit.findMany({
      where: { leadId: ctx.userId },
      select: { id: true, name: true },
    });

    if (mySubUnits.length === 0) return null;
    const subUnitIds = mySubUnits.map((su) => su.id);

    // Fetch review queue (tasks in in_review)
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

    // Sub-unit board (tasks not done/cancelled)
    const activeTasks = await db.task.findMany({
      where: {
        subUnitId: { in: subUnitIds },
        status: { notIn: ["done", "cancelled"] },
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    return {
      reviewQueue,
      activeTasks,
      subUnits: mySubUnits,
    };
  }),

  departmentLead: protectedProcedure.query(async ({ ctx }) => {
    const agencyCtx = await getAgencyAuthContext(ctx.userId);
    if (!can(agencyCtx, "project.update")) return null;

    // Get departments this user leads
    const myDepts = await db.department.findMany({
      where: { leadId: ctx.userId },
      select: { id: true, name: true },
    });

    if (myDepts.length === 0) return null;
    const deptIds = myDepts.map((d) => d.id);

    // Incoming requests for these departments (status = routing or scoping)
    const incomingRequests = await db.request.findMany({
      where: {
        routedDepartmentId: { in: deptIds },
        stage: { in: ["under_review", "scoping", "proposal"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Active projects in these departments
    const activeProjects = await db.project.count({
      where: {
        agencyDepartmentId: { in: deptIds },
        status: { notIn: ["delivered", "closed"] },
      },
    });

    // Latest KPI Snapshot
    const kpiSnapshot = await db.kpiSnapshot.findFirst({
      where: {
        level: "department",
        scopeId: { in: deptIds },
      },
      orderBy: { periodStart: "desc" },
    });

    return {
      departments: myDepts,
      incomingRequests,
      metrics: {
        activeProjects,
      },
      kpiSnapshot,
    };
  }),

  agencyLead: protectedProcedure.query(async ({ ctx }) => {
    const agencyCtx = await getAgencyAuthContext(ctx.userId);
    if (!can(agencyCtx, "workspace.update")) return null;

    const crossAgencyInbox = await db.request.findMany({
      where: { stage: { in: ["submitted", "under_review", "scoping", "proposal"] } },
      orderBy: { urgency: "desc", createdAt: "asc" },
      take: 10,
      include: { routedDepartment: { select: { name: true } } },
    });

    const topProjects = await db.project.findMany({
      where: { status: { in: ["active"] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { department: { select: { name: true } } },
    });

    // Calculate capacity based on all open tasks in the agency
    const agencyWorkspace = await db.workspace.findFirst({ where: { type: "agency" } });
    let capacityStatus = "Healthy";
    if (agencyWorkspace) {
      const activeTasks = await db.task.findMany({
        where: {
          project: { workspaceId: agencyWorkspace.id },
          status: { notIn: ["done", "cancelled"] },
        },
        select: { estimatedHours: true, loggedHours: true },
      });

      let totalRemainingHours = 0;
      for (const t of activeTasks) {
        const est = t.estimatedHours ? Number(t.estimatedHours) : 0;
        const logged = t.loggedHours ? Number(t.loggedHours) : 0;
        const remaining = Math.max(0, est - logged);
        totalRemainingHours += remaining;
      }

      // Sum of workingHoursPerWeek for all members in agency workspace
      const agencyMemberships = await db.membership.findMany({
        where: { workspaceId: agencyWorkspace.id },
        include: { user: { select: { workingHoursPerWeek: true } } },
      });

      const totalWeeklyCapacity = agencyMemberships.reduce((acc, m) => acc + (m.user.workingHoursPerWeek || 40), 0);
      
      if (totalWeeklyCapacity > 0) {
        const loadRatio = totalRemainingHours / totalWeeklyCapacity;
        if (loadRatio > 2) {
          capacityStatus = "Overloaded";
        } else if (loadRatio > 1) {
          capacityStatus = "At Capacity";
        }
      }
    }

    return {
      crossAgencyInbox,
      topProjects,
      throughput: 12, // Still mock
      capacityHeatmap: capacityStatus,
    };
  }),
});
