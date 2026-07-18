import { TRPCError } from "@trpc/server";
import { Prisma, type ProjectStatus } from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { NotificationService } from "@/server/services/notification";
import { getAgencyAuthContext } from "@/server/services/agency";
import { can } from "@/server/auth/permissions";
import { generateCode } from "@/lib/utils/codes";
import { EmailService } from "@/server/notifications/email";

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
    team: { select: { id: true, name: true, slug: true } },
    organization: { select: { id: true, name: true, isExternal: true } },
  } satisfies Prisma.ProjectInclude;

  /** Idempotently create the Project for an approved Request. */
  static async createFromRequest(args: { actorId: string; requestId: string }) {
    const existing = await db.project.findUnique({
      where: { requestId: args.requestId },
    });
    if (existing) return existing;

    const request = await db.request.findUnique({
      where: { id: args.requestId },
      include: { routedTeam: { select: { leadId: true } } },
    });
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });

    const seq = await nextProjectSeq();
    const project = await db.project.create({
      data: {
        code: generateCode("project", seq),
        requestId: request.id,
        organizationId: request.organizationId,
        agencyTeamId: request.routedTeamId,
        pmUserId: request.routedTeam?.leadId ?? args.actorId,
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
    filters: { status?: ProjectStatus; teamId?: string } = {},
  ) {
    return db.project.findMany({
      where: {
        organizationId,
        status: filters.status,
        agencyTeamId: filters.teamId,
      },
      orderBy: { createdAt: "desc" },
      include: {
        ...ProjectService.projectInclude,
        _count: { select: { tasks: true } },
      },
    });
  }

  /** Agency-wide project list across all client organizations. */
  static async listForAgency(filters: { status?: ProjectStatus; teamId?: string } = {}) {
    return db.project.findMany({
      where: { status: filters.status, agencyTeamId: filters.teamId },
      orderBy: { createdAt: "desc" },
      include: {
        ...ProjectService.projectInclude,
        _count: { select: { tasks: true } },
      },
    });
  }

  /**
   * Projects the caller may see: every project for agency staff, otherwise
   * projects belonging to teams the caller belongs to.
   */
  static async listVisibleTo(
    userId: string,
    filters: { status?: ProjectStatus; teamId?: string } = {},
  ) {
    const agencyCtx = await getAgencyAuthContext(userId);
    if (agencyCtx.isSuperAdmin || agencyCtx.roles.includes("agency_admin") || agencyCtx.roles.includes("finance_admin")) {
      return ProjectService.listForAgency(filters);
    }
    const memberships = await db.membership.findMany({
      where: { userId, removedAt: null, acceptedAt: { not: null } },
      select: { teamId: true },
    });
    const teamIds = memberships.map(m => m.teamId).filter(Boolean) as string[];
    return db.project.findMany({
      where: {
        agencyTeamId: { in: teamIds },
        status: filters.status,
      },
      orderBy: { createdAt: "desc" },
      include: {
        ...ProjectService.projectInclude,
        _count: { select: { tasks: true } },
      },
    });
  }

  static async canRead(userId: string, projectId: string): Promise<boolean> {
    const agencyCtx = await getAgencyAuthContext(userId);
    if (!can(agencyCtx, "project.read")) return false;

    if (agencyCtx.isSuperAdmin || agencyCtx.roles.includes("agency_admin") || agencyCtx.roles.includes("finance_admin")) {
      return true;
    }

    const project = await db.project.findUnique({ where: { id: projectId }, select: { agencyTeamId: true } });
    if (!project || !project.agencyTeamId) return false;

    const membership = await db.membership.findFirst({
      where: { userId, teamId: project.agencyTeamId, removedAt: null, acceptedAt: { not: null } }
    });
    return !!membership;
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
    if (args.patch.status === "closed") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Projects close only when the client accepts delivery." });
    }
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
    const before = await db.project.findUnique({
      where: { id: args.projectId },
      include: {
        request: { include: { service: true } },
        tasks: { include: { reviews: true } },
      },
    });
    if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });
    if (before.tasks.length === 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A project needs reviewed work before delivery." });
    }
    const incomplete = before.tasks.filter((task) => !["done", "cancelled"].includes(task.status));
    if (incomplete.length) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Every active task must pass review before delivery." });
    }
    const requiredReviews = Array.isArray(before.request.service?.requiredReviews)
      ? before.request.service.requiredReviews.filter((value): value is string => typeof value === "string")
      : [];
    const missingReview = before.tasks.some((task) => {
      if (task.status === "cancelled") return false;
      const approvals = new Set(
        task.reviews
          .filter((review) => review.revision === task.revision && review.decision === "approved")
          .map((review) => review.reviewType),
      );
      return !approvals.has("team_head") || requiredReviews.some((reviewType) => !approvals.has(reviewType));
    });
    if (missingReview) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Required team-head and specialist reviews must pass before delivery." });
    }
    const deliveredAt = new Date();
    const project = await db.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id: args.projectId },
        data: { status: "delivered", actualDeliveryDate: deliveredAt },
        include: { request: true },
      });
      await tx.request.update({ where: { id: updated.requestId }, data: { stage: "delivered" } });
      await tx.requestStageEvent.create({
        data: { requestId: updated.requestId, fromStage: before.request.stage, toStage: "delivered", actorId: args.actorId, note: "Work delivered for client review." },
      });
      return updated;
    });
    await AuditService.log({
      actorId: args.actorId,

      action: "project.deliver",
      entityType: "Project",
      entityId: project.id,
      after: { status: "delivered" },
    });
    if (project.request.submittedById) {
      await NotificationService.create({
        userId: project.request.submittedById,
        kind: "request_state_changed",
        title: "Your project has been delivered — Action Required",
        body: `Please review and sign off on ${project.name} to close the project.`,
        link: `/projects/${project.id}`,
        entityType: "Project",
        entityId: project.id,
      });
    }
    if (project.request.requesterEmail && project.request.publicToken && project.request.consentToEmail) {
      await EmailService.sendNotification({
        to: project.request.requesterEmail,
        title: `Your project is ready for review (${project.request.code})`,
        body: `The delivered work for "${project.name}" is ready. Use your secure tracking link to accept it or request changes.`,
        ctaLabel: "Review delivery",
        ctaPath: `/track/${project.request.publicToken}`,
      });
    }
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
      data: { csatScore: args.score, csatComment: args.comment ?? null },
    });
    await AuditService.log({
      actorId: args.actorId,

      action: "project.csat_received",
      entityType: "Project",
      entityId: project.id,
      after: { csatScore: args.score },
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
