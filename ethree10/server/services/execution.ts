import { TRPCError } from "@trpc/server";
import type {
  AvailabilityType,
  DeliverableKind,
  DeliverableVisibility,
} from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";

export class ExecutionService {
  static async setContributors(args: {
    actorId: string;
    taskId: string;
    contributors: Array<{
      userId: string;
      contributionRole: string;
      positionId?: string;
      isPrimary?: boolean;
    }>;
  }) {
    const task = await db.task.findUnique({
      where: { id: args.taskId },
      include: { project: { select: { agencyTeamId: true, organizationId: true } } },
    });
    if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found." });
    if (!task.project.agencyTeamId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Route the project to a team before assigning contributors." });
    }
    const userIds = Array.from(new Set(args.contributors.map((item) => item.userId)));
    const eligible = await db.membership.findMany({
      where: {
        userId: { in: userIds },
        teamId: task.project.agencyTeamId,
        acceptedAt: { not: null },
        removedAt: null,
      },
      select: { userId: true },
    });
    const eligibleIds = new Set(eligible.map((membership) => membership.userId));
    const invalid = userIds.filter((userId) => !eligibleIds.has(userId));
    if (invalid.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Every contributor must be an active member of the project team." });
    }
    const primary = args.contributors.find((item) => item.isPrimary) ?? args.contributors[0];
    const result = await db.$transaction(async (tx) => {
      await tx.taskContributor.updateMany({
        where: { taskId: args.taskId, removedAt: null },
        data: { removedAt: new Date(), isPrimary: false },
      });
      for (const contributor of args.contributors) {
        await tx.taskContributor.upsert({
          where: {
            taskId_userId_contributionRole: {
              taskId: args.taskId,
              userId: contributor.userId,
              contributionRole: contributor.contributionRole,
            },
          },
          update: {
            positionId: contributor.positionId ?? null,
            isPrimary: contributor.userId === primary?.userId,
            removedAt: null,
            assignedAt: new Date(),
          },
          create: {
            taskId: args.taskId,
            userId: contributor.userId,
            positionId: contributor.positionId ?? null,
            contributionRole: contributor.contributionRole,
            isPrimary: contributor.userId === primary?.userId,
          },
        });
      }
      await tx.task.update({
        where: { id: args.taskId },
        data: { assigneeUserId: primary?.userId ?? null },
      });
      return tx.taskContributor.findMany({
        where: { taskId: args.taskId, removedAt: null },
        include: { user: true, position: true },
        orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
      });
    });
    await AuditService.log({
      actorId: args.actorId,
      organizationId: task.project.organizationId,
      action: "task.contributors_set",
      entityType: "Task",
      entityId: task.id,
      after: { contributors: result.map((item) => ({ userId: item.userId, role: item.contributionRole })) },
    });
    return result;
  }

  static async recordAvailability(args: {
    actorId: string;
    userId: string;
    type: AvailabilityType;
    startsAt: Date;
    endsAt: Date;
    capacityPercent: number;
    reason?: string;
  }) {
    if (args.endsAt <= args.startsAt) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Availability must end after it starts." });
    }
    const availability = await db.staffAvailability.create({
      data: {
        userId: args.userId,
        type: args.type,
        startsAt: args.startsAt,
        endsAt: args.endsAt,
        capacityPercent: args.type === "leave" ? 0 : args.capacityPercent,
        reason: args.reason ?? null,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      action: "staff.availability_recorded",
      entityType: "StaffAvailability",
      entityId: availability.id,
      after: { userId: args.userId, type: args.type, startsAt: args.startsAt, endsAt: args.endsAt },
    });
    return availability;
  }

  static async workload(teamId: string) {
    const now = new Date();
    const memberships = await db.membership.findMany({
      where: { teamId, acceptedAt: { not: null }, removedAt: null },
      distinct: ["userId"],
      include: {
        user: {
          include: {
            staffAvailability: {
              where: { startsAt: { lte: now }, endsAt: { gte: now } },
              orderBy: { startsAt: "desc" },
              take: 1,
            },
            taskContributions: {
              where: {
                removedAt: null,
                task: { status: { in: ["todo", "in_progress", "blocked", "in_review"] } },
              },
              include: {
                task: { select: { id: true, status: true, estimatedHours: true, loggedHours: true, dueDate: true } },
              },
            },
          },
        },
        position: true,
      },
    });
    return memberships.map((membership) => {
      const availability = membership.user.staffAvailability[0];
      const tasks = membership.user.taskContributions.map((contribution) => contribution.task);
      const remainingHours = tasks.reduce(
        (sum, task) => sum + Math.max(0, Number(task.estimatedHours ?? 0) - Number(task.loggedHours)),
        0,
      );
      const capacityPercent = availability?.capacityPercent ?? 100;
      const weeklyCapacity = membership.user.workingHoursPerWeek * (capacityPercent / 100);
      return {
        userId: membership.userId,
        name: membership.user.name,
        position: membership.position?.name ?? membership.title,
        availability: availability?.type ?? "available",
        capacityPercent,
        weeklyCapacity,
        openTaskCount: tasks.length,
        blockedTaskCount: tasks.filter((task) => task.status === "blocked").length,
        overdueTaskCount: tasks.filter((task) => task.dueDate && task.dueDate < now).length,
        remainingHours,
        utilizationPercent: weeklyCapacity > 0 ? Math.round((remainingHours / weeklyCapacity) * 100) : 100,
      };
    });
  }

  static async createDeliverable(args: {
    actorId: string;
    taskId: string;
    title: string;
    kind: DeliverableKind;
    visibility: DeliverableVisibility;
    url?: string;
    content?: string;
    notes?: string;
  }) {
    if (!args.url && !args.content) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A deliverable needs a file/link URL or document content." });
    }
    const deliverable = await db.deliverable.create({
      data: {
        taskId: args.taskId,
        createdById: args.actorId,
        title: args.title,
        kind: args.kind,
        visibility: args.visibility,
        versions: {
          create: { revision: 1, createdById: args.actorId, url: args.url, content: args.content, notes: args.notes },
        },
      },
      include: { versions: true },
    });
    await AuditService.log({
      actorId: args.actorId,
      action: "deliverable.create",
      entityType: "Deliverable",
      entityId: deliverable.id,
      after: { taskId: args.taskId, kind: args.kind, visibility: args.visibility, revision: 1 },
    });
    return deliverable;
  }

  static async addDeliverableVersion(args: {
    actorId: string;
    deliverableId: string;
    url?: string;
    content?: string;
    notes?: string;
  }) {
    if (!args.url && !args.content) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A version needs a file/link URL or document content." });
    }
    return db.$transaction(async (tx) => {
      const current = await tx.deliverable.findUnique({ where: { id: args.deliverableId } });
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "Deliverable not found." });
      const revision = current.currentRevision + 1;
      const version = await tx.deliverableVersion.create({
        data: {
          deliverableId: current.id,
          revision,
          createdById: args.actorId,
          url: args.url,
          content: args.content,
          notes: args.notes,
        },
      });
      await tx.deliverable.update({ where: { id: current.id }, data: { currentRevision: revision } });
      return version;
    });
  }

  static reviewQueue(teamId?: string) {
    return db.task.findMany({
      where: { status: "in_review", project: { agencyTeamId: teamId } },
      include: {
        project: { include: { organization: true, team: true, request: { include: { service: true } } } },
        contributors: { where: { removedAt: null }, include: { user: true, position: true } },
        deliverables: { include: { versions: { orderBy: { revision: "desc" }, take: 1 } } },
        reviews: { orderBy: { createdAt: "asc" } },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "asc" }],
    });
  }

  static assignments(teamId: string) {
    return db.task.findMany({
      where: {
        project: { agencyTeamId: teamId },
        status: { notIn: ["done", "cancelled"] },
      },
      include: {
        project: { include: { organization: true } },
        contributors: {
          where: { removedAt: null },
          include: { user: true, position: true },
          orderBy: [{ isPrimary: "desc" }, { assignedAt: "asc" }],
        },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "asc" }],
    });
  }
}
