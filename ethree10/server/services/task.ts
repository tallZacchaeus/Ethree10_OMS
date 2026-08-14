import { TRPCError } from "@trpc/server";
import { Prisma, type TaskStatus, type TaskPriority } from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { NotificationService } from "@/server/services/notification";
import { NotificationAudience } from "@/server/services/notification-audience";
import { EmailService } from "@/server/notifications/email";
import { IntegrationService } from "@/server/integrations/core/service";
import { generateCode } from "@/lib/utils/codes";
import { captureCriticalFailure } from "@/lib/observability";

/** Outbound integration sync is best-effort: it must never break local work. */
async function syncOutbound(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // IntegrationService degrades the integration internally; swallow here.
  }
}

async function nextTaskSeq(): Promise<number> {
  const year = new Date().getUTCFullYear();
  const count = await db.task.count({
    where: { createdAt: { gte: new Date(Date.UTC(year, 0, 1)) } },
  });
  return count + 1;
}

async function subUnitLeadId(subUnitId: string | null): Promise<string | null> {
  if (!subUnitId) return null;
  const su = await db.subUnit.findUnique({
    where: { id: subUnitId },
    select: { leadId: true },
  });
  return su?.leadId ?? null;
}

export interface CreateTaskInput {
  projectId: string;
  title: string;
  description?: string;
  acceptanceCriteria?: string;
  subUnitId?: string;
  assigneeUserId?: string;
  priority?: TaskPriority;
  estimatedHours?: number;
  dueDate?: Date;
  dependsOn?: string[];
  contributors?: Array<{
    userId: string;
    contributionRole: string;
    positionId?: string;
    isPrimary?: boolean;
  }>;
}

export class TaskService {
  static taskInclude = {
    subUnit: { select: { id: true, name: true, teamId: true } },
    project: {
      select: { id: true, code: true, name: true, organizationId: true, agencyTeamId: true },
    },
    integrationLink: { select: { id: true, externalUrl: true, pendingSync: true } },
    contributors: {
      where: { removedAt: null },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
        position: { select: { id: true, name: true } },
      },
      orderBy: [{ isPrimary: "desc" as const }, { assignedAt: "asc" as const }],
    },
  } satisfies Prisma.TaskInclude;

  static async getById(id: string) {
    const task = await db.task.findUnique({
      where: { id },
      include: {
        ...TaskService.taskInclude,
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        },
        dependencies: {
          include: {
            dependsOnTask: { select: { id: true, code: true, title: true, status: true } },
          },
        },
        deliverables: {
          orderBy: { updatedAt: "desc" },
          include: { versions: { orderBy: { revision: "desc" } } },
        },
        reviews: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
    const assignee = task.assigneeUserId
      ? await db.user.findUnique({
          where: { id: task.assigneeUserId },
          select: { id: true, name: true, avatarUrl: true },
        })
      : null;
    return { ...task, assignee };
  }

  static async listForProject(projectId: string) {
    return db.task.findMany({
      where: { projectId },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: TaskService.taskInclude,
    });
  }

  static async listAssignedTo(userId: string) {
    return db.task.findMany({
      where: {
        status: { notIn: ["done", "cancelled"] },
        OR: [
          { assigneeUserId: userId },
          { contributors: { some: { userId, removedAt: null } } },
        ],
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      include: TaskService.taskInclude,
    });
  }

  static async recentCompletedBy(userId: string, limit = 5) {
    return db.task.findMany({
      where: { assigneeUserId: userId, status: "done" },
      orderBy: { completedAt: "desc" },
      take: limit,
      include: TaskService.taskInclude,
    });
  }

  /** Candidate assignees for a sub-unit, ranked by current load (best fit first). */
  static async candidates(subUnitId: string) {
    const memberships = await db.membership.findMany({
      where: { subUnitId, removedAt: null, role: { in: ["team_member", "branch_head"] } },
      select: {
        user: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            skills: { include: { skill: { select: { name: true } } } },
          },
        },
      },
    });

    const userIds = memberships.map((m) => m.user.id);
    const loads = await db.task.groupBy({
      by: ["assigneeUserId"],
      where: {
        assigneeUserId: { in: userIds },
        status: { in: ["todo", "in_progress", "in_review"] },
      },
      _count: { _all: true },
      _sum: { estimatedHours: true },
    });
    const loadMap = new Map(
      loads.map((l) => [
        l.assigneeUserId,
        {
          openTaskCount: l._count._all,
          estimatedHoursRemaining: Number(l._sum.estimatedHours ?? 0),
        },
      ]),
    );

    return memberships
      .map((m) => ({
        id: m.user.id,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        skills: m.user.skills.map((s) => s.skill.name),
        openTaskCount: loadMap.get(m.user.id)?.openTaskCount ?? 0,
        estimatedHoursRemaining: loadMap.get(m.user.id)?.estimatedHoursRemaining ?? 0,
      }))
      .sort((a, b) => a.openTaskCount - b.openTaskCount);
  }

  static async create(args: { actorId: string; input: CreateTaskInput }) {
    const project = await db.project.findUnique({
      where: { id: args.input.projectId },
      select: { id: true, organizationId: true },
    });
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });

    const seq = await nextTaskSeq();
    const task = await db.task.create({
      data: {
        code: generateCode("task", seq),
        projectId: args.input.projectId,
        subUnitId: args.input.subUnitId ?? null,
        assigneeUserId: args.input.assigneeUserId ?? null,
        title: args.input.title,
        description: args.input.description ?? null,
        acceptanceCriteria: args.input.acceptanceCriteria ?? null,
        priority: args.input.priority ?? "medium",
        estimatedHours:
          args.input.estimatedHours !== undefined
            ? new Prisma.Decimal(args.input.estimatedHours)
            : null,
        dueDate: args.input.dueDate ?? null,
      },
    });

    const contributors = args.input.contributors?.length
      ? args.input.contributors
      : args.input.assigneeUserId
        ? [{
            userId: args.input.assigneeUserId,
            contributionRole: "Primary contributor",
            isPrimary: true,
          }]
        : [];
    if (contributors.length) {
      await db.taskContributor.createMany({
        data: contributors.map((contributor) => ({
          taskId: task.id,
          userId: contributor.userId,
          positionId: contributor.positionId ?? null,
          contributionRole: contributor.contributionRole,
          isPrimary: contributor.isPrimary ?? false,
        })),
        skipDuplicates: true,
      });
      const primary = contributors.find((contributor) => contributor.isPrimary) ?? contributors[0];
      if (primary && primary.userId !== task.assigneeUserId) {
        await db.task.update({
          where: { id: task.id },
          data: { assigneeUserId: primary.userId },
        });
      }
    }

    if (args.input.dependsOn?.length) {
      await db.taskDependency.createMany({
        data: args.input.dependsOn.map((dependsOnTaskId) => ({
          taskId: task.id,
          dependsOnTaskId,
        })),
        skipDuplicates: true,
      });
    }

    await AuditService.log({
      actorId: args.actorId,
      organizationId: project.organizationId,
      action: "task.create",
      entityType: "Task",
      entityId: task.id,
      after: { code: task.code, title: task.title },
    });

    // Re-read the assignee: a primary contributor may have overridden it above.
    const finalAssigneeId =
      (await db.task.findUnique({ where: { id: task.id }, select: { assigneeUserId: true } }))
        ?.assigneeUserId ?? null;
    if (finalAssigneeId) {
      await TaskService.notifyAssignment(task.id, finalAssigneeId);
    }
    await syncOutbound(() => IntegrationService.onTaskCreated(task));
    return task;
  }

  /**
   * Notify someone that work is now theirs — in-app and by email.
   *
   * The email carries everything the assignee needs to start without opening
   * the app first: what the task is, which project it belongs to, its priority,
   * its deadline, and a direct link. Email delivery is best-effort and never
   * blocks the assignment itself.
   */
  private static async notifyAssignment(taskId: string, assigneeUserId: string): Promise<void> {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { name: true, code: true } },
        subUnit: { select: { name: true } },
      },
    });
    if (!task) return;

    await NotificationService.create({
      userId: assigneeUserId,
      kind: "task_assigned",
      title: `Task assigned: ${task.title}`,
      body: task.code,
      link: `/tasks/${task.id}`,
      entityType: "Task",
      entityId: task.id,
    });

    const assignee = await db.user.findUnique({
      where: { id: assigneeUserId },
      select: { email: true, name: true, timezone: true },
    });
    if (!assignee?.email) return;

    const due = task.dueDate
      ? new Intl.DateTimeFormat("en-GB", {
          dateStyle: "full",
          timeZone: assignee.timezone || "Africa/Lagos",
        }).format(task.dueDate)
      : "No deadline set";

    const lines = [
      `Hi ${assignee.name.split(" ")[0] ?? assignee.name},`,
      ``,
      `You have been assigned "${task.title}" (${task.code}).`,
      ``,
      `Project: ${task.project.name} (${task.project.code})`,
      task.subUnit ? `Department: ${task.subUnit.name}` : null,
      `Priority: ${task.priority}`,
      `Deadline: ${due}`,
      task.estimatedHours ? `Estimated effort: ${task.estimatedHours.toString()} hours` : null,
      ``,
      task.description ? `What needs doing:\n${task.description}` : null,
      task.acceptanceCriteria ? `\nAcceptance criteria:\n${task.acceptanceCriteria}` : null,
    ].filter((line): line is string => line !== null);

    await EmailService.sendNotification({
      to: assignee.email,
      title: `New task assigned: ${task.title}`,
      body: lines.join("\n"),
      ctaLabel: "Open task",
      ctaPath: `/tasks/${task.id}`,
    }).catch((error) => captureCriticalFailure("notification-worker", error, { taskCode: task.code, kind: "assignment" }));
  }

  static async update(args: {
    actorId: string;
    taskId: string;
    patch: {
      title?: string;
      description?: string;
      priority?: TaskPriority;
      estimatedHours?: number;
      dueDate?: Date | null;
      subUnitId?: string | null;
    };
  }) {
    const before = await db.task.findUnique({ where: { id: args.taskId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });
    const updated = await db.task.update({
      where: { id: args.taskId },
      data: {
        title: args.patch.title,
        description: args.patch.description,
        priority: args.patch.priority,
        estimatedHours:
          args.patch.estimatedHours !== undefined
            ? new Prisma.Decimal(args.patch.estimatedHours)
            : undefined,
        dueDate: args.patch.dueDate,
        subUnitId: args.patch.subUnitId,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      action: "task.update",
      entityType: "Task",
      entityId: args.taskId,
      before: { title: before.title, priority: before.priority },
      after: { title: updated.title, priority: updated.priority },
    });
    await syncOutbound(() => IntegrationService.onTaskUpdated(updated));
    return updated;
  }

  static async assign(args: { actorId: string; taskId: string; assigneeUserId: string }) {
    const before = await db.task.findUnique({ where: { id: args.taskId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });
    const updated = await db.$transaction(async (tx) => {
      await tx.taskContributor.updateMany({
        where: { taskId: args.taskId, removedAt: null },
        data: { isPrimary: false },
      });
      await tx.taskContributor.upsert({
        where: {
          taskId_userId_contributionRole: {
            taskId: args.taskId,
            userId: args.assigneeUserId,
            contributionRole: "Primary contributor",
          },
        },
        update: { isPrimary: true, removedAt: null },
        create: {
          taskId: args.taskId,
          userId: args.assigneeUserId,
          contributionRole: "Primary contributor",
          isPrimary: true,
        },
      });
      return tx.task.update({
        where: { id: args.taskId },
        data: { assigneeUserId: args.assigneeUserId },
      });
    });
    await AuditService.log({
      actorId: args.actorId,
      action: "task.assign",
      entityType: "Task",
      entityId: args.taskId,
      before: { assigneeUserId: before.assigneeUserId },
      after: { assigneeUserId: args.assigneeUserId },
    });
    // Only notify on an actual change of hands, so re-saving a task does not
    // spam the same person.
    if (before.assigneeUserId !== args.assigneeUserId) {
      await TaskService.notifyAssignment(args.taskId, args.assigneeUserId);
    }
    await syncOutbound(() => IntegrationService.onTaskUpdated(updated));
    return updated;
  }

  static async transition(args: {
    actorId: string;
    taskId: string;
    toStatus: TaskStatus;
    note?: string;
  }) {
    const before = await db.task.findUnique({ where: { id: args.taskId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });
    const updated = await db.task.update({
      where: { id: args.taskId },
      data: {
        status: args.toStatus,
        startedAt:
          args.toStatus === "in_progress" && !before.startedAt ? new Date() : before.startedAt,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      action: "task.status_changed",
      entityType: "Task",
      entityId: args.taskId,
      before: { status: before.status },
      after: { status: args.toStatus, note: args.note },
    });
    await syncOutbound(() => IntegrationService.onTaskUpdated(updated));
    return updated;
  }

  static async submitCompletion(args: {
    actorId: string;
    taskId: string;
    summary: string;
    evidence?: string;
    hoursLogged?: number;
  }) {
    const before = await db.task.findUnique({ where: { id: args.taskId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });

    const updated = await db.task.update({
      where: { id: args.taskId },
      data: {
        status: "in_review",
        completionSummary: args.summary,
        completionEvidence: args.evidence ?? null,
        loggedHours:
          args.hoursLogged !== undefined
            ? new Prisma.Decimal(Number(before.loggedHours) + args.hoursLogged)
            : before.loggedHours,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      action: "task.completed",
      entityType: "Task",
      entityId: args.taskId,
      after: { status: "in_review" },
    });
    const leadId = await subUnitLeadId(before.subUnitId);
    if (leadId) {
      await NotificationService.create({
        userId: leadId,
        kind: "task_completed",
        title: `Completion to review: ${updated.title}`,
        body: updated.code,
        link: `/tasks/${updated.id}`,
        entityType: "Task",
        entityId: updated.id,
      });
    }
    return updated;
  }

  static async review(args: {
    actorId: string;
    taskId: string;
    decision: "accept" | "request_changes" | "reject" | "cancel";
    note?: string;
    reviewType?: string;
  }) {
    const before = await db.task.findUnique({
      where: { id: args.taskId },
      include: {
        project: { include: { request: { include: { service: true } } } },
      },
    });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });
    if (before.status !== "in_review") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only submitted work can be reviewed." });
    }
    const accepted = args.decision === "accept";
    const revisionsRequired = args.decision === "request_changes";
    const reviewType = args.reviewType ?? "branch_head";
    const requiredReviews = Array.isArray(before.project.request.service?.requiredReviews)
      ? before.project.request.service.requiredReviews.filter((value): value is string => typeof value === "string")
      : [];
    const priorApprovedTypes = await db.taskReview.findMany({
      where: { taskId: args.taskId, revision: before.revision, decision: "approved" },
      select: { reviewType: true },
    });
    const approvedTypes = new Set(priorApprovedTypes.map((review) => review.reviewType));
    if (accepted) approvedTypes.add(reviewType);
    const allRequiredApproved = requiredReviews.every((required) => approvedTypes.has(required));
    const finalApproval = accepted && approvedTypes.has("branch_head") && allRequiredApproved;
    const now = new Date();
    const updated = await db.$transaction(async (tx) => {
      await tx.taskReview.create({
        data: {
          taskId: args.taskId,
          reviewerId: args.actorId,
          reviewType,
          decision: accepted
            ? "approved"
            : revisionsRequired
              ? "revisions_required"
              : args.decision === "reject"
                ? "rejected"
                : "cancelled",
          feedback: args.note ?? null,
          revision: before.revision,
        },
      });
      return tx.task.update({
        where: { id: args.taskId },
        data: {
          status: finalApproval ? "done" : accepted ? "in_review" : revisionsRequired ? "in_progress" : "cancelled",
          reviewedById: args.actorId,
          reviewedAt: now,
          completedAt: finalApproval ? now : null,
          reopenedCount: revisionsRequired ? before.reopenedCount + 1 : before.reopenedCount,
          revision: revisionsRequired ? before.revision + 1 : before.revision,
        },
      });
    });
    await AuditService.log({
      actorId: args.actorId,
      action: finalApproval
        ? "task.review_accepted"
        : accepted
          ? "task.specialist_review_accepted"
          : revisionsRequired
            ? "task.review_changes"
            : `task.review_${args.decision}`,
      entityType: "Task",
      entityId: args.taskId,
      after: { status: updated.status, note: args.note, reviewType, revision: before.revision },
    });
    if (before.assigneeUserId) {
      await NotificationService.create({
        userId: before.assigneeUserId,
        kind: finalApproval ? "task_completed" : "task_assigned",
        title: finalApproval
          ? `Task accepted: ${updated.title}`
          : accepted
            ? `Specialist review passed: ${updated.title}`
            : revisionsRequired
              ? `Changes requested: ${updated.title}`
              : `Task ${args.decision === "reject" ? "rejected" : "cancelled"}: ${updated.title}`,
        body: args.note ?? updated.code,
        link: `/tasks/${updated.id}`,
        entityType: "Task",
        entityId: updated.id,
      });
    }
    return updated;
  }

  static async reopen(args: { actorId: string; taskId: string; reason: string }) {
    const before = await db.task.findUnique({ where: { id: args.taskId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });
    const updated = await db.task.update({
      where: { id: args.taskId },
      data: {
        status: "in_progress",
        completedAt: null,
        reopenedCount: before.reopenedCount + 1,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      action: "task.reopened",
      entityType: "Task",
      entityId: args.taskId,
      after: { reason: args.reason },
    });
    return updated;
  }

  /**
   * Everyone who should hear about activity on a task: the assignee, the lead of
   * the department it sits in, and the head of the branch that owns the project.
   *
   * Without this, a comment only reached people who were explicitly @mentioned —
   * so "I need clarity on this" sat in the thread and notified nobody.
   */
  private static async taskAudience(taskId: string): Promise<string[]> {
    const task = await db.task.findUnique({
      where: { id: taskId },
      select: {
        assigneeUserId: true,
        subUnit: { select: { leadId: true } },
        project: { select: { pmUserId: true, team: { select: { leadId: true } } } },
      },
    });
    if (!task) return [];
    return [
      task.assigneeUserId,
      task.subUnit?.leadId,
      task.project?.team?.leadId,
      task.project?.pmUserId,
    ].filter((id): id is string => Boolean(id));
  }

  static async addComment(args: {
    actorId: string;
    taskId: string;
    body: string;
    isInternal: boolean;
    mentions?: string[];
  }) {
    const comment = await db.taskComment.create({
      data: {
        taskId: args.taskId,
        authorId: args.actorId,
        body: args.body,
        isInternal: args.isInternal,
        mentions: args.mentions ?? [],
      },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const task = await db.task.findUnique({
      where: { id: args.taskId },
      select: { title: true, code: true },
    });

    // Notify the people responsible for this task, minus the author.
    const audience = (await TaskService.taskAudience(args.taskId)).filter(
      (userId) => userId !== args.actorId,
    );
    await NotificationService.createMany(audience, {
      kind: "mention",
      title: `New comment on ${task?.title ?? "a task"}`,
      body: args.body.slice(0, 160),
      link: `/tasks/${args.taskId}`,
      entityType: "Task",
      entityId: args.taskId,
    });

    if (args.mentions?.length) {
      await NotificationService.createMany(
        args.mentions.filter((userId) => !audience.includes(userId) && userId !== args.actorId),
        {
          kind: "mention",
          title: "You were mentioned on a task",
          body: args.body.slice(0, 160),
          link: `/tasks/${args.taskId}`,
          entityType: "Task",
          entityId: args.taskId,
        },
      );
    }
    return comment;
  }

  /**
   * Ask a question about a task and make sure a human actually sees it.
   *
   * `audience: "internal"` puts the question to the department lead, branch head
   * and assignee — in-app and by email, so it does not depend on anyone opening
   * the task.
   *
   * `audience: "client"` escalates it to the requester. The question is posted on
   * the parent **request** thread as a client-visible message, which is what the
   * client's tracking link shows, and they are emailed. A copy stays on the task
   * so the internal history is complete.
   *
   * Either way the task is flagged `isBlocked` so it shows as waiting rather than
   * silently stalling in someone's queue.
   */
  static async askClarification(args: {
    actorId: string;
    taskId: string;
    question: string;
    audience: "internal" | "client";
  }) {
    const task = await db.task.findUnique({
      where: { id: args.taskId },
      include: {
        project: {
          select: {
            name: true,
            requestId: true,
            request: { select: { id: true, code: true, requesterName: true, requesterEmail: true, publicToken: true } },
          },
        },
      },
    });
    if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });

    const asker = await db.user.findUnique({
      where: { id: args.actorId },
      select: { name: true },
    });
    const prefix = args.audience === "client" ? "Question for the client" : "Question";

    // Record the question and flag the task atomically. Doing these separately
    // left an orphaned comment behind whenever the second write failed.
    await db.$transaction([
      db.taskComment.create({
        data: {
          taskId: args.taskId,
          authorId: args.actorId,
          body: `**${prefix}:** ${args.question}`,
          isInternal: args.audience === "internal",
        },
      }),
      db.task.update({
        where: { id: args.taskId },
        data: {
          isBlocked: true,
          blockedReason: `Awaiting clarification: ${args.question.slice(0, 180)}`,
        },
      }),
    ]);

    await AuditService.log({
      actorId: args.actorId,
      action: `task.clarification_${args.audience}`,
      entityType: "Task",
      entityId: args.taskId,
      after: { question: args.question },
    });

    if (args.audience === "internal") {
      const audience = (await TaskService.taskAudience(args.taskId)).filter(
        (userId) => userId !== args.actorId,
      );
      await NotificationService.createMany(audience, {
        kind: "mention",
        title: `Clarification needed: ${task.title}`,
        body: args.question.slice(0, 160),
        link: `/tasks/${args.taskId}`,
        entityType: "Task",
        entityId: args.taskId,
      });

      const recipients = await db.user.findMany({
        where: { id: { in: audience } },
        select: { email: true, name: true },
      });
      for (const recipient of recipients) {
        await EmailService.sendNotification({
          to: recipient.email,
          title: `Clarification needed on ${task.code}`,
          body: `${asker?.name ?? "A team member"} asked about "${task.title}" (${task.project.name}):\n\n${args.question}`,
          ctaLabel: "Answer on the task",
          ctaPath: `/tasks/${args.taskId}`,
        }).catch((error) => captureCriticalFailure("notification-worker", error, { taskCode: task.code, kind: "clarification" }));
      }
      return { routedTo: "internal" as const, notified: audience.length };
    }

    // Client-facing: post on the request thread so it appears on their tracking link.
    const request = task.project.request;
    if (!request) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This task's project has no client request to ask on.",
      });
    }
    await db.taskComment.create({
      data: {
        requestId: request.id,
        authorId: args.actorId,
        body: args.question,
        isInternal: false,
      },
    });

    if (request.requesterEmail) {
      await EmailService.sendNotification({
        to: request.requesterEmail,
        title: `A question about your request ${request.code}`,
        body: `The team working on "${task.project.name}" has a question:\n\n${args.question}\n\nReply on your tracking link and they will pick it up.`,
        ctaLabel: "Reply to the team",
        ctaPath: request.publicToken ? `/track/${request.publicToken}` : `/`,
      }).catch((error) => captureCriticalFailure("notification-worker", error, { requestCode: request.code, kind: "client-clarification" }));
    }
    return { routedTo: "client" as const, notified: request.requesterEmail ? 1 : 0 };
  }

  /** Clear a blocker once the question has been answered, and tell the assignee. */
  static async resolveBlocker(args: { actorId: string; taskId: string }) {
    const task = await db.task.update({
      where: { id: args.taskId },
      data: { isBlocked: false, blockedReason: null },
    });
    await AuditService.log({
      actorId: args.actorId,
      action: "task.blocker_resolved",
      entityType: "Task",
      entityId: args.taskId,
      after: { isBlocked: false },
    });
    if (task.assigneeUserId && task.assigneeUserId !== args.actorId) {
      await NotificationService.create({
        userId: task.assigneeUserId,
        kind: "mention",
        title: `Unblocked: ${task.title}`,
        body: "Your question was answered — you can carry on.",
        link: `/tasks/${task.id}`,
        entityType: "Task",
        entityId: task.id,
      });
    }
    return task;
  }

  /**
   * Daily sweep for work approaching or past its due date.
   *
   * Both `task_due_soon` and `task_overdue` existed as notification kinds from
   * the start but nothing ever emitted them — a task could sail past its
   * deadline and the only way to notice was to look. Runs from the reports
   * worker; see workers/index.ts.
   *
   * Dedup is left ON deliberately here: this runs every day against the same
   * tasks, and the hour-long window plus a per-day schedule means one reminder
   * per task per run rather than a pile-up.
   */
  static async notifyDueAndOverdue(now = new Date()): Promise<{ dueSoon: number; overdue: number }> {
    const soon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const open: { notIn: TaskStatus[] } = { notIn: ["done", "cancelled"] };

    const dueSoon = await db.task.findMany({
      where: { status: open, dueDate: { gte: now, lte: soon } },
      select: { id: true, title: true, dueDate: true, assigneeUserId: true, projectId: true },
    });

    const overdue = await db.task.findMany({
      where: { status: open, dueDate: { lt: now } },
      select: { id: true, title: true, dueDate: true, assigneeUserId: true, projectId: true },
    });

    for (const task of dueSoon) {
      if (!task.assigneeUserId) continue;
      await NotificationService.create({
        userId: task.assigneeUserId,
        kind: "task_due_soon",
        title: `Due soon: ${task.title}`,
        body: `Due ${task.dueDate?.toDateString() ?? "shortly"}.`,
        link: `/tasks/${task.id}`,
        entityType: "Task",
        entityId: task.id,
      });
    }

    for (const task of overdue) {
      // Overdue goes wider than the assignee: the lead chasing delivery needs
      // it too, and an assignee who has gone quiet is exactly the case where
      // telling only them achieves nothing.
      const recipients = new Set<string>();
      if (task.assigneeUserId) recipients.add(task.assigneeUserId);
      if (task.projectId) {
        for (const id of await NotificationAudience.projectTeam(task.projectId)) recipients.add(id);
      }
      if (recipients.size === 0) continue;
      await NotificationService.createMany(Array.from(recipients), {
        kind: "task_overdue",
        title: `Overdue: ${task.title}`,
        body: `Was due ${task.dueDate?.toDateString() ?? "earlier"}.`,
        link: `/tasks/${task.id}`,
        entityType: "Task",
        entityId: task.id,
      });
    }

    return { dueSoon: dueSoon.length, overdue: overdue.length };
  }
}
