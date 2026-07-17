import { db } from "@/server/db/client";

export async function computeTeamEvidence(teamId: string, start: Date, end: Date) {
  // 1. Milestone delivery (% of milestones completed on or before due date)
  const milestones = await db.milestone.findMany({
    where: {
      project: { agencyTeamId: teamId },
      completedAt: { gte: start, lte: end },
    },
  });

  let milestoneDelivery = 0;
  if (milestones.length > 0) {
    const onTime = milestones.filter(
      (m) => m.dueDate && m.completedAt && m.completedAt <= m.dueDate,
    ).length;
    milestoneDelivery = onTime / milestones.length;
  }

  // 2. Task completion rate (tasks completed vs total tasks in the period)
  const [completedTasks, totalTasks] = await Promise.all([
    db.task.count({
      where: {
        project: { agencyTeamId: teamId },
        status: "done",
        completedAt: { gte: start, lte: end },
      },
    }),
    db.task.count({
      where: {
        project: { agencyTeamId: teamId },
        createdAt: { lte: end },
        OR: [{ completedAt: null }, { completedAt: { lte: end } }],
      },
    }),
  ]);
  const taskCompletionRate = totalTasks > 0 ? completedTasks / totalTasks : 0;

  // 3. Workflow standardization (# active project templates)
  const templatesCount = await db.projectTemplate.count({
    where: { archivedAt: null },
  });

  // 4. Projects delivered in period
  const requestsDelivered = await db.project.count({
    where: {
      agencyTeamId: teamId,
      status: "delivered",
      actualDeliveryDate: { gte: start, lte: end },
    },
  });

  // 5. QA adoption — % of tasks that were reviewed (have reviewedById set) before completion
  const [reviewedTasks, completedTasksTotal] = await Promise.all([
    db.task.count({
      where: {
        project: { agencyTeamId: teamId },
        status: "done",
        completedAt: { gte: start, lte: end },
        reviewedById: { not: null },
      },
    }),
    db.task.count({
      where: {
        project: { agencyTeamId: teamId },
        status: "done",
        completedAt: { gte: start, lte: end },
      },
    }),
  ]);
  const qaAdoption = completedTasksTotal > 0 ? reviewedTasks / completedTasksTotal : 0;

  // 6. Project roadmap coverage — % of projects with at least one milestone defined
  const [projectsWithMilestones, totalProjects] = await Promise.all([
    db.project.count({
      where: {
        agencyTeamId: teamId,
        milestones: { some: {} },
        createdAt: { lte: end },
      },
    }),
    db.project.count({
      where: {
        agencyTeamId: teamId,
        createdAt: { lte: end },
        status: { notIn: ["cancelled"] },
      },
    }),
  ]);
  const projectRoadmap = totalProjects > 0 ? projectsWithMilestones / totalProjects : 0;

  // 7. Cross-functional collaboration — % of tasks assigned to members from a different sub-unit
  //    Proxy: tasks that have a subUnitId explicitly set (meaning they were routed cross-unit)
  const [crossUnitTasks, totalAssignedTasks] = await Promise.all([
    db.task.count({
      where: {
        project: { agencyTeamId: teamId },
        subUnitId: { not: null },
        completedAt: { gte: start, lte: end },
      },
    }),
    db.task.count({
      where: {
        project: { agencyTeamId: teamId },
        assigneeUserId: { not: null },
        completedAt: { gte: start, lte: end },
      },
    }),
  ]);
  const crossFunctional = totalAssignedTasks > 0 ? crossUnitTasks / totalAssignedTasks : 0;

  // 8. Release coordination — % of milestones completed on-time agency-wide (all departments)
  const allMilestones = await db.milestone.findMany({
    where: {
      project: { agencyTeamId: teamId },
      completedAt: { gte: start, lte: end },
      dueDate: { not: null },
    },
  });
  const releaseCoordination =
    allMilestones.length > 0
      ? allMilestones.filter(
          (m) => m.dueDate && m.completedAt && m.completedAt <= m.dueDate,
        ).length / allMilestones.length
      : 0;

  return {
    milestoneDelivery,
    taskCompletionRate,
    workflowStandardization: templatesCount,
    requestsDelivered,
    qaAdoption,
    projectRoadmap,
    crossFunctional,
    releaseCoordination,
  };
}

export async function computeAgencyEvidence(start: Date, end: Date) {
  // 1. Projects delivered agency-wide
  const requestsDelivered = await db.project.count({
    where: { status: "delivered", actualDeliveryDate: { gte: start, lte: end } },
  });

  // 2. CSAT average from projects with a csatScore
  const csatProjects = await db.project.findMany({
    where: {
      status: "delivered",
      csatScore: { not: null },
      actualDeliveryDate: { gte: start, lte: end },
    },
    select: { csatScore: true },
  });
  const csatAverage =
    csatProjects.length > 0
      ? csatProjects.reduce((acc, r) => acc + (r.csatScore ?? 0), 0) / csatProjects.length
      : 0;

  // 3. Revenue collection rate — paid invoices / total issued invoices in period
  const [paidInvoices, issuedInvoices] = await Promise.all([
    db.invoice.count({
      where: {
        status: "paid",
        paidAt: { gte: start, lte: end },
      },
    }),
    db.invoice.count({
      where: {
        issuedAt: { gte: start, lte: end },
      },
    }),
  ]);
  const revenueTarget = issuedInvoices > 0 ? paidInvoices / issuedInvoices : 0;

  return {
    requestsDelivered,
    csatAverage,
    revenueTarget,
  };
}
