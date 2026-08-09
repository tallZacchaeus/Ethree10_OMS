import { TRPCError } from "@trpc/server";
import { Prisma, type ReportLevel, type ReportPeriod } from "@prisma/client";
import { db } from "@/server/db/client";
import { NotificationService } from "@/server/services/notification";
import { EmailService } from "@/server/notifications/email";
import { generatePdfBuffer } from "@/server/reports/pdf";
import { uploadFile } from "@/lib/storage";
import { KpiService } from "@/server/services/kpi";

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
    const prior = await this.previousMetrics(scope.level, scope.scopeId, period, start);

    /** "12 (up from 8)" — movement, not a bare number. */
    const withTrend = (current: number, previous: number | undefined, unit = "") => {
      if (previous === undefined || previous === null) return `${current}${unit}`;
      const delta = current - previous;
      if (delta === 0) return `${current}${unit} (unchanged)`;
      return `${current}${unit} (${delta > 0 ? "up" : "down"} from ${previous}${unit})`;
    };

    const narrative = {
      executiveSummary: `${withTrend(metrics.tasksCompleted, prior?.tasksCompleted)} tasks completed and ${withTrend(metrics.projectsDelivered, prior?.projectsDelivered)} projects delivered during this period.`,
      outcomes: `${metrics.projectsAccepted} client deliveries accepted; ${metrics.deliverablesCreated} deliverable revisions produced.`,
      qualityAndTimeliness: `${withTrend(Math.round(metrics.onTimeRate * 100), prior ? Math.round(prior.onTimeRate * 100) : undefined, "%")} of completed tasks met their due date; ${withTrend(metrics.revisionsRequested, prior?.revisionsRequested)} revisions were requested.`,
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
    const [teams, departments, members, organizations] = await Promise.all([
      db.team.findMany({ where: { archivedAt: null }, select: { id: true, leadId: true, name: true } }),
      // Departments are real org units with leads and members, so they get their
      // own rollup. This level existed in the enum and in every scope helper but
      // had been dropped from generation, leaving department leads with nothing.
      db.subUnit.findMany({ where: { archivedAt: null }, select: { id: true, leadId: true, name: true } }),
      db.membership.findMany({ where: { removedAt: null, acceptedAt: { not: null } }, distinct: ["userId"], select: { userId: true } }),
      db.organization.findMany({ where: { archivedAt: null, OR: [{ projects: { some: {} } }, { requests: { some: {} } }] }, select: { id: true } }),
    ]);

    await this.generate({ level: "agency", scopeId: "agency" }, args.period, periodStart, periodEnd, args.actorId);

    for (const team of teams) {
      const report = await this.generateTeamReport(team.id, args.period, periodStart, periodEnd, args.actorId);
      if (team.leadId) await NotificationService.create({ userId: team.leadId, kind: "report_ready", title: `${args.period === "weekly" ? "Weekly" : "Monthly"} branch report ready`, body: `${team.name}'s draft report is ready for review.`, link: `/reports/${report.id}`, entityType: "Report", entityId: report.id });
    }

    for (const department of departments) {
      const report = await this.generate({ level: "subunit", scopeId: department.id }, args.period, periodStart, periodEnd, args.actorId);
      if (department.leadId) await NotificationService.create({ userId: department.leadId, kind: "report_ready", title: `${args.period === "weekly" ? "Weekly" : "Monthly"} department report ready`, body: `${department.name}'s draft report is ready for review.`, link: `/reports/${report.id}`, entityType: "Report", entityId: report.id });
    }

    for (const member of members) await this.generateMemberReport(member.userId, args.period, periodStart, periodEnd, args.actorId);
    for (const organization of organizations) await this.generate({ level: "organization", scopeId: organization.id }, args.period, periodStart, periodEnd, args.actorId);

    // Scorecards are computed from the same window. Nothing called KpiService
    // before, so `KpiSnapshot` was only ever read and the dashboard's KPI widget
    // could never show anything.
    const snapshots = await this.computeScorecards(args.period, periodStart, periodEnd);

    return {
      ok: true,
      periodStart,
      periodEnd,
      generated: 1 + teams.length + departments.length + members.length + organizations.length,
      scorecards: snapshots,
    };
  }

  /** Run every configured scorecard for the period and persist its snapshot. */
  static async computeScorecards(period: ReportPeriod, periodStart: Date, periodEnd: Date): Promise<number> {
    const configs = await db.scorecardConfig.findMany({ where: { isActive: true } });
    let computed = 0;
    for (const config of configs) {
      try {
        await KpiService.computeSnapshot({ config, periodStart, periodEnd, period });
        computed += 1;
      } catch (error) {
        console.error("Scorecard computation failed", config.id, error);
      }
    }
    return computed;
  }

  /**
   * Metrics for the period immediately before this one, so a report can show
   * movement rather than a bare number. "12 tasks completed" says nothing;
   * "12, down from 18" says everything.
   */
  static async previousMetrics(
    level: ReportLevel,
    scopeId: string,
    period: ReportPeriod,
    periodStart: Date,
  ): Promise<ReportMetrics | null> {
    const previous = await db.report.findFirst({
      where: { level, scopeId, period, periodStart: { lt: periodStart } },
      orderBy: { periodStart: "desc" },
      select: { metrics: true },
    });
    return (previous?.metrics as unknown as ReportMetrics) ?? null;
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

    const finalized = await db.report.update({
      where: { id: report.id },
      data: { status: "finalized", finalizedAt: new Date(), finalizedById: args.actorId },
    });

    // Render and store the PDF at finalisation, not on every draft regeneration.
    // Until now `pdfUrl` was written as null and nothing ever set it, so the
    // "PDF exports ready" tile on /reports counted a field no code populated.
    const pdfUrl = await ReportService.storePdf(finalized.id).catch((error) => {
      console.error("Report PDF generation failed", finalized.id, error);
      return null;
    });

    await ReportService.deliverFinalized(finalized.id).catch((error) =>
      console.error("Report delivery failed", finalized.id, error),
    );

    return pdfUrl ? { ...finalized, pdfUrl } : finalized;
  }

  /** Human name for whatever a report is scoped to. */
  static async scopeName(level: ReportLevel, scopeId: string): Promise<string> {
    if (level === "agency") return "Ethree10 Agency";
    if (level === "member") return (await db.user.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name ?? "Member";
    if (level === "team") return (await db.team.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name ?? "Branch";
    if (level === "subunit") return (await db.subUnit.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name ?? "Department";
    if (level === "organization") return (await db.organization.findUnique({ where: { id: scopeId }, select: { name: true } }))?.name ?? "Client";
    return "Report";
  }

  /** Render the report to PDF, store it, and record the URL. */
  static async storePdf(reportId: string): Promise<string> {
    const report = await db.report.findUnique({ where: { id: reportId } });
    if (!report) throw new TRPCError({ code: "NOT_FOUND" });

    const buffer = await generatePdfBuffer({
      type: report.level,
      period: report.period,
      scopeName: await ReportService.scopeName(report.level, report.scopeId),
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      metrics: report.metrics as Record<string, unknown>,
      narrative:
        report.narrative && typeof report.narrative === "object" && !Array.isArray(report.narrative)
          ? (report.narrative as Record<string, unknown>)
          : undefined,
      version: report.version,
    });

    const url = await uploadFile(
      `reports/${report.level}/${report.id}-v${report.version}.pdf`,
      buffer,
      "application/pdf",
    );
    await db.report.update({ where: { id: report.id }, data: { pdfUrl: url } });
    return url;
  }

  /**
   * Email a finalized report to the people accountable for it.
   *
   * Generation without delivery is why reports were being produced every week
   * and read by nobody. Branch reports go to the branch head; every report also
   * goes to the Chief Executive, who is accountable for the whole agency.
   */
  static async deliverFinalized(reportId: string): Promise<{ sentTo: number }> {
    const report = await db.report.findUnique({ where: { id: reportId } });
    if (!report || report.status !== "finalized") return { sentTo: 0 };

    const recipientIds = new Set<string>();

    if (report.level === "member") {
      recipientIds.add(report.scopeId);
    }
    if (report.level === "team") {
      const team = await db.team.findUnique({ where: { id: report.scopeId }, select: { leadId: true } });
      if (team?.leadId) recipientIds.add(team.leadId);
    }
    if (report.level === "subunit") {
      const dept = await db.subUnit.findUnique({ where: { id: report.scopeId }, select: { leadId: true } });
      if (dept?.leadId) recipientIds.add(dept.leadId);
    }
    // The Chief Executive sees every finalized report.
    const executives = await db.membership.findMany({
      where: { role: "chief_executive", removedAt: null, acceptedAt: { not: null } },
      select: { userId: true },
    });
    for (const executive of executives) recipientIds.add(executive.userId);

    if (recipientIds.size === 0) return { sentTo: 0 };

    const scopeName = await ReportService.scopeName(report.level, report.scopeId);
    const metrics = report.metrics as unknown as ReportMetrics;
    const narrative = (report.narrative ?? {}) as Record<string, string>;
    const periodLabel = `${report.periodStart.toDateString()} – ${report.periodEnd.toDateString()}`;

    const recipients = await db.user.findMany({
      where: { id: { in: Array.from(recipientIds) }, deactivatedAt: null },
      select: { id: true, email: true },
    });

    for (const recipient of recipients) {
      await NotificationService.create({
        userId: recipient.id,
        kind: "report_ready",
        title: `${report.period === "weekly" ? "Weekly" : "Monthly"} report finalized: ${scopeName}`,
        body: periodLabel,
        link: `/reports/${report.id}`,
        entityType: "Report",
        entityId: report.id,
      });

      await EmailService.sendNotification({
        to: recipient.email,
        title: `${scopeName} — ${report.period} report (${periodLabel})`,
        body: [
          narrative["executiveSummary"] ?? "",
          "",
          `Tasks completed: ${metrics.tasksCompleted}`,
          `Projects delivered: ${metrics.projectsDelivered}`,
          `On-time rate: ${Math.round((metrics.onTimeRate ?? 0) * 100)}%`,
          `Hours logged: ${metrics.hoursLogged}`,
          "",
          narrative["risksAndNextSteps"] ?? "",
        ]
          .filter(Boolean)
          .join("\n"),
        ctaLabel: "Open the report",
        ctaPath: `/reports/${report.id}`,
      }).catch((error) => console.error("Report email failed", report.id, recipient.email, error));
    }

    return { sentTo: recipients.length };
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
