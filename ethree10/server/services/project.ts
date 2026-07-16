import { TRPCError } from "@trpc/server";
import { Prisma, type ProjectStatus } from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { NotificationService } from "@/server/services/notification";
import { getAgencyAuthContext } from "@/server/services/agency";
import { can } from "@/server/auth/permissions";
import { generateCode } from "@/lib/utils/codes";

async function nextProjectSeq(): Promise<number> {
  const year = new Date().getUTCFullYear();
  const count = await db.project.count({
    where: { createdAt: { gte: new Date(Date.UTC(year, 0, 1)) } },
  });
  return count + 1;
}

export class ProjectService {
  static projectInclude = {
    request: { select: { id: true, code: true, urgency: true, submittedById: true } },
    department: { select: { id: true, name: true, slug: true } },
    organization: { select: { id: true, name: true, isExternal: true } },
  } satisfies Prisma.ProjectInclude;

  /** Idempotently create the Project for an approved Request. */
  static async createFromRequest(args: { actorId: string; requestId: string }) {
    const existing = await db.project.findUnique({
      where: { requestId: args.requestId },
    });
    if (existing) return existing;

    const request = await db.request.findUnique({ where: { id: args.requestId } });
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });

    const seq = await nextProjectSeq();
    const project = await db.project.create({
      data: {
        code: generateCode("project", seq),
        requestId: request.id,
        organizationId: request.organizationId,
        agencyDepartmentId: request.routedDepartmentId,
        name: request.title,
        description: request.description,
        status: "active",
        startDate: new Date(),
        targetDeliveryDate: request.deadline,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      organizationId: request.organizationId,
      action: "project.create",
      entityType: "Project",
      entityId: project.id,
      after: { code: project.code, requestId: request.id },
    });
    return project;
  }

  static async getById(id: string) {
    const project = await db.project.findUnique({
      where: { id },
      include: {
        ...ProjectService.projectInclude,
        tasks: {
          orderBy: { createdAt: "asc" },
          include: {
            subUnit: { select: { id: true, name: true } },
            integrationLink: { select: { externalUrl: true, pendingSync: true } },
          },
        },
        milestones: { orderBy: { order: "asc" } },
      },
    });
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });

    const assigneeIds = Array.from(
      new Set(
        project.tasks
          .map((t) => t.assigneeUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const users = assigneeIds.length
      ? await db.user.findMany({
          where: { id: { in: assigneeIds } },
          select: { id: true, name: true, avatarUrl: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));
    const tasks = project.tasks.map((t) => ({
      ...t,
      assignee: t.assigneeUserId ? userMap.get(t.assigneeUserId) ?? null : null,
    }));
    return { ...project, tasks };
  }

  static async listForWorkspace(
    organizationId: string,
    filters: { status?: ProjectStatus; departmentId?: string } = {},
  ) {
    return db.project.findMany({
      where: {
        organizationId,
        status: filters.status,
        agencyDepartmentId: filters.departmentId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        ...ProjectService.projectInclude,
        _count: { select: { tasks: true } },
      },
    });
  }

  /** Agency-wide project list across all client workspaces. */
  static async listForAgency(filters: { status?: ProjectStatus; departmentId?: string } = {}) {
    return db.project.findMany({
      where: { status: filters.status, agencyDepartmentId: filters.departmentId },
      orderBy: { createdAt: "desc" },
      include: {
        ...ProjectService.projectInclude,
        _count: { select: { tasks: true } },
      },
    });
  }

  /**
   * Projects the caller may see: every project for agency staff, otherwise
   * projects belonging to workspaces the caller is a member of.
   */
  static async listVisibleTo(
    userId: string,
    filters: { status?: ProjectStatus; departmentId?: string } = {},
  ) {
    const agencyCtx = await getAgencyAuthContext(userId);
    if (can(agencyCtx, "project.read")) {
      return ProjectService.listForAgency(filters);
    }
    const memberships = await db.membership.findMany({
      where: { userId, removedAt: null, acceptedAt: { not: null } },
      select: { organizationId: true },
    });
    const organizationIds = memberships
      .map((m) => m.organizationId)
      .filter((id): id is string => id !== null);
    return db.project.findMany({
      where: { organizationId: { in: organizationIds }, status: filters.status },
      orderBy: { createdAt: "desc" },
      include: {
        ...ProjectService.projectInclude,
        _count: { select: { tasks: true } },
      },
    });
  }

  static async canRead(userId: string, projectId: string): Promise<boolean> {
    const agencyCtx = await getAgencyAuthContext(userId);
    if (can(agencyCtx, "project.read")) return true;
    const project = await db.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) return false;
    const membership = await db.membership.findFirst({
      where: {
        userId,
        organizationId: project.organizationId,
        removedAt: null,
        acceptedAt: { not: null },
      },
      select: { id: true },
    });
    return Boolean(membership);
  }

  static async update(args: {
    actorId: string;
    projectId: string;
    patch: {
      name?: string;
      description?: string;
      status?: ProjectStatus;
      pmUserId?: string;
      targetDeliveryDate?: Date;
    };
  }) {
    const before = await db.project.findUnique({ where: { id: args.projectId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });
    const updated = await db.project.update({
      where: { id: args.projectId },
      data: args.patch,
    });
    await AuditService.log({
      actorId: args.actorId,
      organizationId: before.organizationId,
      action: "project.update",
      entityType: "Project",
      entityId: args.projectId,
      before: { status: before.status },
      after: { status: updated.status },
    });
    return updated;
  }

  static async deliver(args: { actorId: string; projectId: string }) {
    const project = await db.project.update({
      where: { id: args.projectId },
      data: { status: "delivered", actualDeliveryDate: new Date() },
      include: { request: { select: { submittedById: true } } },
    });
    await AuditService.log({
      actorId: args.actorId,
      organizationId: project.organizationId,
      action: "project.deliver",
      entityType: "Project",
      entityId: project.id,
      after: { status: "delivered" },
    });
    await NotificationService.create({
      userId: project.request.submittedById,
      kind: "request_state_changed",
      title: "Your project has been delivered — Action Required",
      body: `Please review and sign off on ${project.name} to close the project.`,
      link: `/projects/${project.id}`,
      entityType: "Project",
      entityId: project.id,
    });
    return project;
  }

  static async recordCsat(args: {
    actorId: string;
    projectId: string;
    score: number;
    comment?: string;
  }) {
    const project = await db.project.update({
      where: { id: args.projectId },
      data: { csatScore: args.score, csatComment: args.comment ?? null, status: "closed" },
    });
    // Request must also transition to closed
    await db.request.update({
      where: { id: project.requestId },
      data: { stage: "closed" },
    });
    await AuditService.log({
      actorId: args.actorId,
      organizationId: project.organizationId,
      action: "project.csat_received",
      entityType: "Project",
      entityId: project.id,
      after: { csatScore: args.score, status: "closed" },
    });
    
    // Also notify agency lead/PM about the feedback
    if (project.pmUserId) {
      await NotificationService.create({
        userId: project.pmUserId,
        kind: "csat_received",
        title: "CSAT Feedback Received",
        body: `${project.code} received a score of ${args.score}/5.`,
        link: `/projects/${project.id}`,
        entityType: "Project",
        entityId: project.id,
      });
    }

    return project;
  }
}
