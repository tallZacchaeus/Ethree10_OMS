import { TRPCError } from "@trpc/server";
import { Prisma, type ReportLevel, type ReportPeriod } from "@prisma/client";
import { db } from "@/server/db/client";
import { NotificationService } from "@/server/services/notification";

export const REPORT_TIMEZONE = "Africa/Lagos";
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Lagos is UTC+1 year-round. Bounds are persisted as UTC instants. */
export function reportPeriodBounds(period: ReportPeriod, anchor = new Date()) {
  const local = new Date(anchor.getTime() + HOUR);
  let localStart: Date;
  let localNext: Date;
  if (period === "monthly") {
    localStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1));
    localNext = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 1));
  } else {
    const weekday = local.getUTCDay() || 7;
    localStart = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - weekday + 1));
    localNext = new Date(localStart.getTime() + 7 * DAY);
  }
  return {
    periodStart: new Date(localStart.getTime() - HOUR),
    periodEnd: new Date(localNext.getTime() - HOUR - 1),
    cutoffAt: new Date(localNext.getTime() - HOUR),
  };
}

export const weekBounds = (anchor?: Date) => reportPeriodBounds("weekly", anchor);

export interface ReportMetrics {
  requestsReceived: number;
  projectsDelivered: number;
  projectsAccepted: number;
  tasksCompleted: number;
  tasksOnTime: number;
  tasksOverdue: number;
  tasksInProgress: number;
  deliverablesCreated: number;
  reviewsPerformed: number;
  revisionsRequested: number;
  collaborationNotes: number;
  blockers: number;
  hoursLogged: number;
  contributorCount: number;
  onTimeRate: number;
}

export interface MemberMetrics extends ReportMetrics {
  openTasks: number;
  commentsPosted: number;
}

export type SubUnitMetrics = ReportMetrics & {
  members: number;
  topPerformers: Array<{ name: string; completed: number }>;
};

type Scope = { level: ReportLevel; scopeId: string };
type Contribution = {
  sourceKey: string;
  type: "assignment" | "completion" | "deliverable" | "time" | "collaboration" | "review" | "revision" | "blocker";
  userId?: string;
  taskId?: string;
  projectId?: string;
  organizationId?: string;
  teamId?: string;
  summary: string;
  outcome?: string;
  effortHours?: number;
  occurredAt: Date;
  metadata?: Prisma.InputJsonValue;
};

function taskScopeWhere(scope: Scope): Prisma.TaskWhereInput {
  if (scope.level === "team") return { project: { agencyTeamId: scope.scopeId } };
  if (scope.level === "organization") return { project: { organizationId: scope.scopeId } };
  if (scope.level === "member") {
    return { OR: [{ assigneeUserId: scope.scopeId }, { contributors: { some: { userId: scope.scopeId } } }] };
  }
  if (scope.level === "subunit") return { subUnitId: scope.scopeId };
  return {};
}

function projectScopeWhere(scope: Scope): Prisma.ProjectWhereInput {
  if (scope.level === "team") return { agencyTeamId: scope.scopeId };
  if (scope.level === "organization") return { organizationId: scope.scopeId };
  if (scope.level === "member") return { tasks: { some: taskScopeWhere(scope) } };
  if (scope.level === "subunit") return { tasks: { some: { subUnitId: scope.scopeId } } };
  return {};
}

function requestScopeWhere(scope: Scope): Prisma.RequestWhereInput {
  if (scope.level === "team") return { routedTeamId: scope.scopeId };
  if (scope.level === "organization") return { organizationId: scope.scopeId };
  if (scope.level === "member") return { project: { tasks: { some: taskScopeWhere(scope) } } };
  if (scope.level === "subunit") return { project: { tasks: { some: { subUnitId: scope.scopeId } } } };
  return {};
}

export class ReportService {
  static list(filters: { level?: ReportLevel; scopeId?: string; period?: ReportPeriod } = {}) {
    return db.report.findMany({
      where: filters,
      orderBy: [{ periodStart: "desc" }, { level: "asc" }],
    });
  }

  static async buildSnapshot(scope: Scope, start: Date, end: Date) {
    const tasks = await db.task.findMany({
      where: taskScopeWhere(scope),
      include: {
        project: { select: { id: true, organizationId: true, agencyTeamId: true, name: true } },
        contributors: { include: { user: { select: { id: true, name: true } } } },
        timeLogs: { where: { date: { gte: start, lte: end } } },
        deliverables: { include: { versions: { where: { createdAt: { gte: start, lte: end } } } } },
        reviews: { where: { createdAt: { gte: start, lte: end } } },
        comments: { where: { createdAt: { gte: start, lte: end }, authorId: { not: null } } },
      },
    });
    const contributions: Contribution[] = [];
    const visibleTasks = scope.level === "member"
      ? tasks.filter((task) => task.assigneeUserId === scope.scopeId || task.contributors.some((c) => c.userId === scope.scopeId))
      : tasks;

    for (const task of visibleTasks) {
      const base = { taskId: task.id, projectId: task.projectId, organizationId: task.project.organizationId, teamId: task.project.agencyTeamId ?? undefined };
      for (const contributor of task.contributors) {
        if (contributor.assignedAt >= start && contributor.assignedAt <= end && (scope.level !== "member" || contributor.userId === scope.scopeId)) {
          contributions.push({ ...base, sourceKey: `assignment:${task.id}:${contributor.userId}:${contributor.contributionRole}`, type: "assignment", userId: contributor.userId, summary: `${contributor.user.name} joined ${task.title} as ${contributor.contributionRole}.`, occurredAt: contributor.assignedAt });
        }
      }
      if (task.completedAt && task.completedAt >= start && task.completedAt <= end) {
        const completionContributors = task.contributors.filter((c) => c.assignedAt <= task.completedAt! && (!c.removedAt || c.removedAt >= task.completedAt!) && (scope.level !== "member" || c.userId === scope.scopeId));
        const credited = completionContributors.length ? completionContributors : task.assigneeUserId ? [{ userId: task.assigneeUserId, user: { name: "Assigned contributor" } }] : [];
        for (const contributor of credited) {
          contributions.push({ ...base, sourceKey: `completion:${task.id}:${contributor.userId}`, type: "completion", userId: contributor.userId, summary: `${contributor.user.name} contributed to completing ${task.title}.`, outcome: task.completionSummary ?? undefined, occurredAt: task.completedAt });
        }
      }
      for (const log of task.timeLogs.filter((item) => scope.level !== "member" || item.userId === scope.scopeId)) {
        contributions.push({ ...base, sourceKey: `time:${log.id}`, type: "time", userId: log.userId, summary: `Effort recorded on ${task.title}.`, effortHours: Number(log.hours), occurredAt: log.date, metadata: { note: log.note } });
      }
      for (const deliverable of task.deliverables) for (const version of deliverable.versions) {
        if (scope.level === "member" && version.createdById !== scope.scopeId) continue;
        contributions.push({ ...base, sourceKey: `deliverable:${version.id}`, type: "deliverable", userId: version.createdById, summary: `${deliverable.title} revision ${version.revision} was produced.`, occurredAt: version.createdAt, metadata: { visibility: deliverable.visibility, kind: deliverable.kind } });
      }
      for (const review of task.reviews.filter((item) => scope.level !== "member" || item.reviewerId === scope.scopeId)) {
        contributions.push({ ...base, sourceKey: `review:${review.id}`, type: review.decision === "revisions_required" ? "revision" : "review", userId: review.reviewerId, summary: `${task.title} review: ${review.decision.replace(/_/g, " ")}.`, outcome: review.feedback ?? undefined, occurredAt: review.createdAt, metadata: { reviewType: review.reviewType, revision: review.revision } });
      }
      for (const comment of task.comments.filter((item) => scope.level !== "member" || item.authorId === scope.scopeId)) {
        contributions.push({ ...base, sourceKey: `collaboration:${comment.id}`, type: "collaboration", userId: comment.authorId ?? undefined, summary: `Collaboration note added on ${task.title}.`, occurredAt: comment.createdAt });
      }
      if (task.status === "blocked" && task.updatedAt >= start && task.updatedAt <= end) {
        contributions.push({ ...base, sourceKey: `blocker:${task.id}:${task.updatedAt.toISOString()}`, type: "blocker", userId: task.assigneeUserId ?? undefined, summary: `${task.title} was blocked.`, occurredAt: task.updatedAt });
      }
    }

    const completed = new Map(visibleTasks.filter((t) => t.completedAt && t.completedAt >= start && t.completedAt <= end).map((t) => [t.id, t]));
    const onTime = Array.from(completed.values()).filter((task) => !task.dueDate || task.completedAt! <= task.dueDate).length;
    const [requestsReceived, projectsDelivered, projectsAccepted] = await Promise.all([
      db.request.count({ where: { ...requestScopeWhere(scope), createdAt: { gte: start, lte: end } } }),
      db.project.count({ where: { ...projectScopeWhere(scope), actualDeliveryDate: { gte: start, lte: end } } }),
      db.clientDecision.count({ where: { decision: "accepted", createdAt: { gte: start, lte: end }, project: projectScopeWhere(scope) } }),
    ]);
    const hoursLogged = contributions.filter((c) => c.type === "time").reduce((sum, c) => sum + (c.effortHours ?? 0), 0);
    const metrics: ReportMetrics = {
      requestsReceived,
      projectsDelivered,
      projectsAccepted,
      tasksCompleted: completed.size,
      tasksOnTime: onTime,
      tasksOverdue: visibleTasks.filter((task) => task.status !== "done" && task.status !== "cancelled" && Boolean(task.dueDate && task.dueDate < end)).length,
      tasksInProgress: visibleTasks.filter((task) => ["todo", "in_progress", "in_review", "blocked"].includes(task.status)).length,
      deliverablesCreated: contributions.filter((c) => c.type === "deliverable").length,
      reviewsPerformed: contributions.filter((c) => c.type === "review" || c.type === "revision").length,
      revisionsRequested: contributions.filter((c) => c.type === "revision").length,
      collaborationNotes: contributions.filter((c) => c.type === "collaboration").length,
      blockers: contributions.filter((c) => c.type === "blocker").length,
      hoursLogged: Number(hoursLogged.toFixed(2)),
      contributorCount: new Set(contributions.flatMap((c) => c.userId ? [c.userId] : [])).size,
      onTimeRate: completed.size ? onTime / completed.size : 0,
    };
    return { metrics, contributions };
  }

  static async memberMetrics(userId: string, start: Date, end: Date): Promise<MemberMetrics> {
    const { metrics } = await this.buildSnapshot({ level: "member", scopeId: userId }, start, end);
    return { ...metrics, openTasks: metrics.tasksInProgress, commentsPosted: metrics.collaborationNotes };
  }

  static async generate(scope: Scope, period: ReportPeriod, start: Date, end: Date, actorId?: string | null) {
    const existing = await db.report.findUnique({
      where: { level_period_scopeId_periodStart: { ...scope, period, periodStart: start } },
    });
    if (existing?.status === "finalized") return existing;
    const { metrics, contributions } = await this.buildSnapshot(scope, start, end);
    const narrative = {
      executiveSummary: `${metrics.tasksCompleted} tasks completed and ${metrics.projectsDelivered} projects delivered during this period.`,
      outcomes: `${metrics.projectsAccepted} client deliveries accepted; ${metrics.deliverablesCreated} deliverable revisions produced.`,
      qualityAndTimeliness: `${Math.round(metrics.onTimeRate * 100)}% of completed tasks met their due date; ${metrics.revisionsRequested} revisions were requested.`,
      collaborationAndEffort: `${metrics.contributorCount} contributors recorded ${metrics.hoursLogged} hours alongside ${metrics.collaborationNotes} collaboration notes. Hours are context, not a performance score.`,
      risksAndNextSteps: metrics.blockers ? `${metrics.blockers} blocker records require follow-up.` : "No blockers were recorded in this period.",
    };
    const authoredById = actorId && actorId !== "system" && await db.user.findUnique({ where: { id: actorId }, select: { id: true } }) ? actorId : null;
    const metricsJson = metrics as unknown as Prisma.InputJsonValue;
    return db.$transaction(async (tx) => {
      const report = await tx.report.upsert({
        where: { level_period_scopeId_periodStart: { ...scope, period, periodStart: start } },
        update: { metrics: metricsJson, narrative, periodEnd: end, cutoffAt: new Date(end.getTime() + 1), authoredById, organizationId: scope.level === "organization" ? scope.scopeId : null },
        create: { ...scope, period, periodStart: start, periodEnd: end, cutoffAt: new Date(end.getTime() + 1), metrics: metricsJson, narrative, authoredById, organizationId: scope.level === "organization" ? scope.scopeId : null, pdfUrl: null },
      });
      await tx.reportContribution.deleteMany({ where: { reportId: report.id } });
      if (contributions.length) await tx.reportContribution.createMany({ data: contributions.map((item) => ({ ...item, reportId: report.id, effortHours: item.effortHours !== undefined ? new Prisma.Decimal(item.effortHours) : undefined })) });
      return report;
    });
  }

  static generateMemberReport(userId: string, period: ReportPeriod, start: Date, end: Date, actorId?: string) {
    return this.generate({ level: "member", scopeId: userId }, period, start, end, actorId);
  }

  static generateTeamReport(teamId: string, period: ReportPeriod, start: Date, end: Date, actorId?: string) {
    return this.generate({ level: "team", scopeId: teamId }, period, start, end, actorId);
  }

  static async generateCycle(args: { period: ReportPeriod; actorId?: string; anchor?: Date }) {
    const { periodStart, periodEnd } = reportPeriodBounds(args.period, args.anchor);
    const [teams, members, organizations] = await Promise.all([
      db.team.findMany({ where: { archivedAt: null }, select: { id: true, leadId: true, name: true } }),
      db.membership.findMany({ where: { removedAt: null, acceptedAt: { not: null } }, distinct: ["userId"], select: { userId: true } }),
      db.organization.findMany({ where: { archivedAt: null, OR: [{ projects: { some: {} } }, { requests: { some: {} } }] }, select: { id: true } }),
    ]);
    await this.generate({ level: "agency", scopeId: "agency" }, args.period, periodStart, periodEnd, args.actorId);
    for (const team of teams) {
      const report = await this.generateTeamReport(team.id, args.period, periodStart, periodEnd, args.actorId);
      if (team.leadId) await NotificationService.create({ userId: team.leadId, kind: "report_ready", title: `${args.period === "weekly" ? "Weekly" : "Monthly"} team report ready`, body: `${team.name}'s draft report is ready for review.`, link: `/reports/${report.id}`, entityType: "Report", entityId: report.id });
    }
    for (const member of members) await this.generateMemberReport(member.userId, args.period, periodStart, periodEnd, args.actorId);
    for (const organization of organizations) await this.generate({ level: "organization", scopeId: organization.id }, args.period, periodStart, periodEnd, args.actorId);
    return { ok: true, periodStart, periodEnd, generated: 1 + teams.length + members.length + organizations.length };
  }

  static generateWeekly(args: { actorId: string; anchor?: Date }) {
    return this.generateCycle({ period: "weekly", actorId: args.actorId, anchor: args.anchor });
  }

  static generateMonthly(args: { actorId: string; anchor?: Date }) {
    return this.generateCycle({ period: "monthly", actorId: args.actorId, anchor: args.anchor });
  }

  static async updateNarrative(args: { reportId: string; narrative: Prisma.InputJsonValue; actorId: string }) {
    const report = await db.report.findUnique({ where: { id: args.reportId } });
    if (!report) throw new TRPCError({ code: "NOT_FOUND" });
    if (report.status === "finalized") throw new TRPCError({ code: "BAD_REQUEST", message: "Finalized reports require a recorded amendment." });
    return db.report.update({ where: { id: report.id }, data: { narrative: args.narrative, authoredById: args.actorId } });
  }

  static async finalize(args: { reportId: string; actorId: string }) {
    const report = await db.report.findUnique({ where: { id: args.reportId } });
    if (!report) throw new TRPCError({ code: "NOT_FOUND" });
    if (report.status === "finalized") return report;
    return db.report.update({ where: { id: report.id }, data: { status: "finalized", finalizedAt: new Date(), finalizedById: args.actorId } });
  }

  static async amend(args: { reportId: string; actorId: string; reason: string; metrics: Prisma.InputJsonValue; narrative: Prisma.InputJsonValue }) {
    const report = await db.report.findUnique({ where: { id: args.reportId } });
    if (!report) throw new TRPCError({ code: "NOT_FOUND" });
    if (report.status !== "finalized") throw new TRPCError({ code: "BAD_REQUEST", message: "Only finalized reports are amended." });
    return db.$transaction(async (tx) => {
      await tx.reportAmendment.create({ data: { reportId: report.id, amendedById: args.actorId, reason: args.reason, previousMetrics: report.metrics as unknown as Prisma.InputJsonValue, previousNarrative: report.narrative === null ? undefined : report.narrative as Prisma.InputJsonValue, newMetrics: args.metrics, newNarrative: args.narrative } });
      return tx.report.update({ where: { id: report.id }, data: { metrics: args.metrics, narrative: args.narrative, version: { increment: 1 } } });
    });
  }
}
