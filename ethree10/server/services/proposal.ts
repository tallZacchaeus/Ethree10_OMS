import { TRPCError } from "@trpc/server";
import { Prisma, type ProposalStatus } from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { NotificationService } from "@/server/services/notification";
import { ProjectService } from "@/server/services/project";
import { AuthorizationService } from "@/server/services/authorization";

export class ProposalService {
  /**
   * A proposal may only be responded to (accepted/rejected) by someone who
   * belongs to the proposal's workspace, or a super admin. Without this, any
   * signed-in user could accept/reject another workspace's proposal by id.
   */
  private static async assertCanRespond(actorId: string, workspaceId: string | undefined) {
    if (!workspaceId) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Proposal is not linked to a workspace." });
    }
    const ctx = await AuthorizationService.resolve(actorId, workspaceId);
    if (!ctx.isSuperAdmin && ctx.membershipIds.length === 0) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this proposal." });
    }
  }

  static async getById(id: string) {
    const proposal = await db.proposal.findUnique({
      where: { id },
      include: {
        request: { select: { id: true, code: true, title: true, workspaceId: true, submittedById: true } },
        project: { select: { id: true, code: true, name: true, workspaceId: true } },
      },
    });
    if (!proposal) throw new TRPCError({ code: "NOT_FOUND", message: "Proposal not found." });
    return proposal;
  }

  static async listForRequest(requestId: string) {
    return db.proposal.findMany({
      where: { requestId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async listForProject(projectId: string) {
    return db.proposal.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  }

  static async create(args: {
    actorId: string;
    requestId?: string;
    projectId?: string;
    title: string;
    summary?: string;
    currency: string;
    lineItems: Array<{ label: string; qty: number; unitPrice: number }>;
    terms?: string;
    validUntil?: Date;
  }) {
    if (!args.requestId && !args.projectId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Must provide requestId or projectId" });
    }

    let workspaceId: string | undefined;
    if (args.requestId) {
      const req = await db.request.findUnique({ where: { id: args.requestId }, select: { workspaceId: true } });
      workspaceId = req?.workspaceId;
    } else if (args.projectId) {
      const proj = await db.project.findUnique({ where: { id: args.projectId }, select: { workspaceId: true } });
      workspaceId = proj?.workspaceId;
    }

    const total = args.lineItems.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);

    const proposal = await db.proposal.create({
      data: {
        requestId: args.requestId,
        projectId: args.projectId,
        title: args.title,
        summary: args.summary,
        currency: args.currency,
        total,
        lineItems: args.lineItems as any,
        terms: args.terms,
        validUntil: args.validUntil,
        status: "draft",
      },
    });

    if (workspaceId) {
      await AuditService.log({
        actorId: args.actorId,
        workspaceId,
        action: "proposal.create",
        entityType: "Proposal",
        entityId: proposal.id,
      });
    }

    return proposal;
  }

  static async update(args: {
    actorId: string;
    proposalId: string;
    patch: {
      title?: string;
      summary?: string;
      currency?: string;
      lineItems?: Array<{ label: string; qty: number; unitPrice: number }>;
      terms?: string;
      validUntil?: Date;
    };
  }) {
    const before = await ProposalService.getById(args.proposalId);
    if (before.status !== "draft") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Can only update draft proposals." });
    }

    let total = before.total;
    if (args.patch.lineItems) {
      total = new Prisma.Decimal(args.patch.lineItems.reduce((acc, item) => acc + item.qty * item.unitPrice, 0));
    }

    const updated = await db.proposal.update({
      where: { id: args.proposalId },
      data: {
        ...args.patch,
        total,
      },
    });

    const workspaceId = before.request?.workspaceId || before.project?.workspaceId;
    if (workspaceId) {
      await AuditService.log({
        actorId: args.actorId,
        workspaceId,
        action: "proposal.update",
        entityType: "Proposal",
        entityId: updated.id,
      });
    }

    return updated;
  }

  static async send(args: { actorId: string; proposalId: string }) {
    const before = await ProposalService.getById(args.proposalId);
    
    // Create PDF URL logic would go here. For now we will assume it's created dynamically on the /api/reports route
    const pdfUrl = `/api/reports/proposals/${args.proposalId}/pdf`;

    const updated = await db.proposal.update({
      where: { id: args.proposalId },
      data: { status: "sent", sentAt: new Date(), pdfUrl },
    });

    const workspaceId = before.request?.workspaceId || before.project?.workspaceId;
    if (workspaceId) {
      await AuditService.log({
        actorId: args.actorId,
        workspaceId,
        action: "proposal.send",
        entityType: "Proposal",
        entityId: updated.id,
        before: { status: before.status },
        after: { status: "sent" },
      });
    }

    // Notify requester
    if (before.request) {
      await NotificationService.create({
        userId: before.request.submittedById,
        kind: "proposal_sent",
        title: "You received a new proposal",
        body: `Please review the proposal for ${before.request.code}`,
        link: `/requests/${before.request.id}/proposals/${updated.id}`,
        entityType: "Proposal",
        entityId: updated.id,
      });
    }

    return updated;
  }

  static async accept(args: { actorId: string; proposalId: string }) {
    const before = await ProposalService.getById(args.proposalId);
    await ProposalService.assertCanRespond(
      args.actorId,
      before.request?.workspaceId || before.project?.workspaceId,
    );
    if (before.status !== "sent") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only sent proposals can be accepted." });
    }

    const updated = await db.proposal.update({
      where: { id: args.proposalId },
      data: { status: "accepted", acceptedAt: new Date(), acceptedById: args.actorId },
    });

    const workspaceId = before.request?.workspaceId || before.project?.workspaceId;
    if (workspaceId) {
      await AuditService.log({
        actorId: args.actorId,
        workspaceId,
        action: "proposal.accept",
        entityType: "Proposal",
        entityId: updated.id,
        before: { status: before.status },
        after: { status: "accepted" },
      });
    }

    // If this proposal was linked to a request, automatically approve the request and create a project
    if (before.requestId && before.request) {
      // Find the request
      const req = await db.request.findUnique({ where: { id: before.requestId } });
      if (req && req.stage === "proposal") {
        // Approve request
        await db.request.update({
          where: { id: before.requestId },
          data: { stage: "approved", approvedById: args.actorId },
        });
        await db.requestStageEvent.create({
          data: {
            requestId: before.requestId,
            fromStage: "proposal",
            toStage: "approved",
            actorId: args.actorId,
            note: "Proposal accepted",
          },
        });
        const proj = await ProjectService.createFromRequest({ actorId: args.actorId, requestId: before.requestId });
        
        // Link project to this proposal
        await db.proposal.update({
          where: { id: updated.id },
          data: { projectId: proj.id },
        });
      }
    }

    return updated;
  }

  static async reject(args: { actorId: string; proposalId: string; reason: string }) {
    const before = await ProposalService.getById(args.proposalId);
    await ProposalService.assertCanRespond(
      args.actorId,
      before.request?.workspaceId || before.project?.workspaceId,
    );
    const updated = await db.proposal.update({
      where: { id: args.proposalId },
      data: { status: "rejected" },
    });

    const workspaceId = before.request?.workspaceId || before.project?.workspaceId;
    if (workspaceId) {
      await AuditService.log({
        actorId: args.actorId,
        workspaceId,
        action: "proposal.reject",
        entityType: "Proposal",
        entityId: updated.id,
        after: { status: "rejected", reason: args.reason },
      });
    }

    return updated;
  }
}
