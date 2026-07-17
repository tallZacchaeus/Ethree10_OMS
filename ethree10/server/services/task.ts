import { TRPCError } from "@trpc/server";
import { Prisma, type TaskStatus, type TaskPriority } from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { NotificationService } from "@/server/services/notification";
import { IntegrationService } from "@/server/integrations/core/service";
import { generateCode } from "@/lib/utils/codes";

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
      where: { subUnitId, removedAt: null, role: { in: ["team_member", "team_head"] } },
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

    if (task.assigneeUserId) {
      await NotificationService.create({
        userId: task.assigneeUserId,
        kind: "task_assigned",
        title: `Task assigned: ${task.title}`,
        body: task.code,
        link: `/tasks/${task.id}`,
        entityType: "Task",
        entityId: task.id,
      });
    }
    await syncOutbound(() => IntegrationService.onTaskCreated(task));
    return task;
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
    await NotificationService.create({
      userId: args.assigneeUserId,
      kind: "task_assigned",
      title: `Task assigned: ${updated.title}`,
      body: updated.code,
      link: `/tasks/${updated.id}`,
      entityType: "Task",
      entityId: updated.id,
    });
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
    const reviewType = args.reviewType ?? "team_head";
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
    const finalApproval = accepted && approvedTypes.has("team_head") && allRequiredApproved;
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
    if (args.mentions?.length) {
      await NotificationService.createMany(args.mentions, {
        kind: "mention",
        title: "You were mentioned on a task",
        link: `/tasks/${args.taskId}`,
        entityType: "Task",
        entityId: args.taskId,
      });
    }
    return comment;
  }
}
