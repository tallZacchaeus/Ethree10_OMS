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
  subUnitId?: string;
  assigneeUserId?: string;
  priority?: TaskPriority;
  estimatedHours?: number;
  dueDate?: Date;
  dependsOn?: string[];
}

export class TaskService {
  static taskInclude = {
    subUnit: { select: { id: true, name: true, teamId: true } },
    project: {
      select: { id: true, code: true, name: true, organizationId: true, agencyTeamId: true },
    },
    integrationLink: { select: { id: true, externalUrl: true, pendingSync: true } },
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
      where: { assigneeUserId: userId, status: { notIn: ["done", "cancelled"] } },
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
        priority: args.input.priority ?? "medium",
        estimatedHours:
          args.input.estimatedHours !== undefined
            ? new Prisma.Decimal(args.input.estimatedHours)
            : null,
        dueDate: args.input.dueDate ?? null,
      },
    });

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
    const updated = await db.task.update({
      where: { id: args.taskId },
      data: { assigneeUserId: args.assigneeUserId },
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
    decision: "accept" | "request_changes";
    note?: string;
  }) {
    const before = await db.task.findUnique({ where: { id: args.taskId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });
    const accepted = args.decision === "accept";
    const updated = await db.task.update({
      where: { id: args.taskId },
      data: {
        status: accepted ? "done" : "in_progress",
        reviewedById: args.actorId,
        reviewedAt: new Date(),
        completedAt: accepted ? new Date() : null,
        reopenedCount: accepted ? before.reopenedCount : before.reopenedCount + 1,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      action: accepted ? "task.review_accepted" : "task.review_changes",
      entityType: "Task",
      entityId: args.taskId,
      after: { status: updated.status, note: args.note },
    });
    if (before.assigneeUserId) {
      await NotificationService.create({
        userId: before.assigneeUserId,
        kind: accepted ? "task_completed" : "task_assigned",
        title: accepted
          ? `Task accepted: ${updated.title}`
          : `Changes requested: ${updated.title}`,
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
