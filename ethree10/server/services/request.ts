import { TRPCError } from "@trpc/server";
import { Prisma, type RequestStage, type Urgency } from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { NotificationService } from "@/server/services/notification";
import { getAgencyWorkspaceId } from "@/server/services/agency";
import { ProjectService } from "@/server/services/project";
import { ApprovalService } from "@/server/services/approval";
import { generateCode } from "@/lib/utils/codes";

export const ALLOWED_TRANSITIONS: Record<RequestStage, RequestStage[]> = {
  submitted: ["under_review", "rejected", "cancelled", "pending_approval"],
  pending_approval: ["under_review", "scoping", "rejected", "cancelled"],
  under_review: ["scoping", "rejected", "on_hold", "cancelled"],
  scoping: ["proposal", "approved", "on_hold", "cancelled", "pending_approval"],
  proposal: ["approved", "rejected", "on_hold", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["in_review", "on_hold", "cancelled"],
  in_review: ["delivered", "in_progress"],
  delivered: ["closed", "in_review"],
  closed: [],
  rejected: [],
  on_hold: ["under_review", "scoping", "in_progress", "cancelled"],
  cancelled: [],
};

export interface CreateRequestInput {
  title: string;
  description: string;
  projectType: string;
  urgency: Urgency;
  deadline?: Date;
  primaryContact?: string;
  budgetEstimate?: number;
  currency?: string;
}

async function nextRequestSeq(workspaceId: string): Promise<number> {
  const year = new Date().getUTCFullYear();
  const count = await db.request.count({
    where: {
      workspaceId,
      createdAt: { gte: new Date(Date.UTC(year, 0, 1)) },
    },
  });
  return count + 1;
}

async function agencyLeadUserIds(): Promise<string[]> {
  const agencyId = await getAgencyWorkspaceId();
  if (!agencyId) return [];
  const leads = await db.membership.findMany({
    where: {
      workspaceId: agencyId,
      role: { in: ["admin"] },
      removedAt: null,
      acceptedAt: { not: null },
    },
    select: { userId: true },
  });
  return leads.map((m) => m.userId);
}

export class RequestService {
  static requestInclude = {
    routedDepartment: { select: { id: true, name: true, slug: true } },
    workspace: { select: { id: true, name: true, type: true, slug: true } },
    project: { select: { id: true, code: true, status: true } },
    stageEvents: {
      orderBy: { createdAt: "asc" } as const,
    },
  } satisfies Prisma.RequestInclude;

  static async getById(id: string) {
    const request = await db.request.findUnique({
      where: { id },
      include: {
        ...RequestService.requestInclude,
        comments: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
        },
        attachments: true,
      },
    });
    if (!request) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found." });
    const submitter = await db.user.findUnique({
      where: { id: request.submittedById },
      select: { id: true, name: true, avatarUrl: true },
    });
    return { ...request, submitter };
  }

  static async listForWorkspace(
    workspaceId: string,
    filters: { stage?: RequestStage; routedDepartmentId?: string; limit?: number } = {},
  ) {
    return db.request.findMany({
      where: {
        workspaceId,
        stage: filters.stage,
        routedDepartmentId: filters.routedDepartmentId,
      },
      orderBy: { createdAt: "desc" },
      take: filters.limit ?? 50,
      include: RequestService.requestInclude,
    });
  }

  /** Agency-wide triage queue: requests across all client workspaces. */
  static async inbox(filters: { stage?: RequestStage; routedDepartmentId?: string } = {}) {
    const agencyId = await getAgencyWorkspaceId();
    return db.request.findMany({
      where: {
        workspaceId: agencyId ? { not: agencyId } : undefined,
        stage: filters.stage ?? { in: ["submitted", "under_review", "scoping"] },
        routedDepartmentId: filters.routedDepartmentId,
      },
      orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
      take: 200,
      include: RequestService.requestInclude,
    });
  }

  static async listSubmittedBy(userId: string) {
    return db.request.findMany({
      where: { submittedById: userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: RequestService.requestInclude,
    });
  }

  static async create(args: {
    actorId: string;
    workspaceId: string;
    input: CreateRequestInput;
  }) {
    const seq = await nextRequestSeq(args.workspaceId);
    const code = generateCode("request", seq);
    const created = await db.request.create({
      data: {
        code,
        workspaceId: args.workspaceId,
        submittedById: args.actorId,
        title: args.input.title,
        description: args.input.description,
        projectType: args.input.projectType,
        urgency: args.input.urgency,
        deadline: args.input.deadline ?? null,
        primaryContact: args.input.primaryContact ?? null,
        budgetEstimate:
          args.input.budgetEstimate !== undefined
            ? new Prisma.Decimal(args.input.budgetEstimate)
            : null,
        currency: args.input.currency ?? "NGN",
        stage: "submitted",
      },
    });
    await db.requestStageEvent.create({
      data: { requestId: created.id, toStage: "submitted", actorId: args.actorId },
    });
    await AuditService.log({
      actorId: args.actorId,
      workspaceId: args.workspaceId,
      action: "request.create",
      entityType: "Request",
      entityId: created.id,
      after: { stage: created.stage, code: created.code },
    });
    await NotificationService.createMany(await agencyLeadUserIds(), {
      kind: "request_submitted",
      title: `New request: ${created.title}`,
      body: created.code,
      link: `/requests/${created.id}`,
      entityType: "Request",
      entityId: created.id,
    });
    return created;
  }

  static async route(args: {
    actorId: string;
    requestId: string;
    departmentId: string;
    note?: string;
  }) {
    const before = await db.request.findUnique({ where: { id: args.requestId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });

    const department = await db.department.findUnique({
      where: { id: args.departmentId },
      select: { id: true, name: true, leadId: true },
    });
    if (!department) throw new TRPCError({ code: "NOT_FOUND", message: "Department not found." });

    const advanceToReview = before.stage === "submitted";
    let targetStage = advanceToReview ? "under_review" : before.stage;

    if (advanceToReview) {
      const workspace = await db.workspace.findUnique({ where: { id: before.workspaceId } });
      if (workspace) {
        const rule = await ApprovalService.checkRules(before as any, workspace);
        if (rule) {
          targetStage = "pending_approval";
          await ApprovalService.notifyApprovers(rule, before as any);
        }
      }
    }

    const updated = await db.request.update({
      where: { id: args.requestId },
      data: {
        routedDepartmentId: args.departmentId,
        stage: targetStage as any,
      },
    });
    if (targetStage !== before.stage) {
      await db.requestStageEvent.create({
        data: {
          requestId: args.requestId,
          fromStage: before.stage,
          toStage: targetStage as any,
          actorId: args.actorId,
          note: args.note ?? null,
        },
      });
    }
    await AuditService.log({
      actorId: args.actorId,
      workspaceId: before.workspaceId,
      action: "request.route",
      entityType: "Request",
      entityId: args.requestId,
      before: { routedDepartmentId: before.routedDepartmentId },
      after: { routedDepartmentId: args.departmentId },
    });
    if (department.leadId) {
      await NotificationService.create({
        userId: department.leadId,
        kind: "request_assigned",
        title: `Request routed to ${department.name}`,
        body: `${updated.code}: ${updated.title}`,
        link: `/requests/${updated.id}`,
        entityType: "Request",
        entityId: updated.id,
      });
    }
    return updated;
  }

  static async transition(args: {
    actorId: string;
    requestId: string;
    toStage: RequestStage;
    note?: string;
  }) {
    const before = await db.request.findUnique({ where: { id: args.requestId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });

    const allowed = ALLOWED_TRANSITIONS[before.stage] ?? [];
    if (!allowed.includes(args.toStage)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Illegal transition: ${before.stage} → ${args.toStage}`,
      });
    }

    const updated = await db.request.update({
      where: { id: args.requestId },
      data: { stage: args.toStage },
    });
    await db.requestStageEvent.create({
      data: {
        requestId: args.requestId,
        fromStage: before.stage,
        toStage: args.toStage,
        actorId: args.actorId,
        note: args.note ?? null,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      workspaceId: before.workspaceId,
      action: "request.transition",
      entityType: "Request",
      entityId: args.requestId,
      before: { stage: before.stage },
      after: { stage: args.toStage },
    });
    await NotificationService.create({
      userId: before.submittedById,
      kind: "request_state_changed",
      title: `Your request is now ${args.toStage.replace(/_/g, " ")}`,
      body: `${updated.code}: ${updated.title}`,
      link: `/requests/${updated.id}`,
      entityType: "Request",
      entityId: updated.id,
    });

    if (args.toStage === "approved") {
      await ProjectService.createFromRequest({ actorId: args.actorId, requestId: args.requestId });
    }
    return updated;
  }

  static async approve(args: { actorId: string; requestId: string }) {
    const before = await db.request.findUnique({ where: { id: args.requestId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });
    const updated = await db.request.update({
      where: { id: args.requestId },
      data: { stage: "approved", approvedById: args.actorId },
    });
    await db.requestStageEvent.create({
      data: {
        requestId: args.requestId,
        fromStage: before.stage,
        toStage: "approved",
        actorId: args.actorId,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      workspaceId: before.workspaceId,
      action: "request.approve",
      entityType: "Request",
      entityId: args.requestId,
      before: { stage: before.stage },
      after: { stage: "approved" },
    });
    await ProjectService.createFromRequest({ actorId: args.actorId, requestId: args.requestId });
    await NotificationService.create({
      userId: before.submittedById,
      kind: "request_state_changed",
      title: "Your request was approved",
      body: `${updated.code}: ${updated.title}`,
      link: `/requests/${updated.id}`,
      entityType: "Request",
      entityId: updated.id,
    });
    return updated;
  }

  static async reject(args: { actorId: string; requestId: string; reason: string }) {
    const before = await db.request.findUnique({ where: { id: args.requestId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });
    const updated = await db.request.update({
      where: { id: args.requestId },
      data: { stage: "rejected", rejectedReason: args.reason },
    });
    await db.requestStageEvent.create({
      data: {
        requestId: args.requestId,
        fromStage: before.stage,
        toStage: "rejected",
        actorId: args.actorId,
        note: args.reason,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      workspaceId: before.workspaceId,
      action: "request.reject",
      entityType: "Request",
      entityId: args.requestId,
      before: { stage: before.stage },
      after: { stage: "rejected", reason: args.reason },
    });
    await NotificationService.create({
      userId: before.submittedById,
      kind: "request_state_changed",
      title: "Your request was not accepted",
      body: args.reason,
      link: `/requests/${updated.id}`,
      entityType: "Request",
      entityId: updated.id,
    });
    return updated;
  }

  static async update(args: {
    actorId: string;
    requestId: string;
    patch: Partial<Pick<CreateRequestInput, "title" | "description" | "urgency" | "deadline">>;
  }) {
    const before = await db.request.findUnique({ where: { id: args.requestId } });
    if (!before) throw new TRPCError({ code: "NOT_FOUND" });
    const updated = await db.request.update({
      where: { id: args.requestId },
      data: {
        title: args.patch.title,
        description: args.patch.description,
        urgency: args.patch.urgency,
        deadline: args.patch.deadline,
      },
    });
    await AuditService.log({
      actorId: args.actorId,
      workspaceId: before.workspaceId,
      action: "request.update",
      entityType: "Request",
      entityId: args.requestId,
      before: { title: before.title, urgency: before.urgency },
      after: { title: updated.title, urgency: updated.urgency },
    });
    return updated;
  }

  static async addComment(args: {
    actorId: string;
    requestId: string;
    body: string;
    isInternal: boolean;
    mentions?: string[];
  }) {
    const comment = await db.taskComment.create({
      data: {
        requestId: args.requestId,
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
        title: "You were mentioned on a request",
        link: `/requests/${args.requestId}`,
        entityType: "Request",
        entityId: args.requestId,
      });
    }
    return comment;
  }
}
