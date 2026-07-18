import { TRPCError } from "@trpc/server";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { NotificationService } from "@/server/services/notification";

const PUBLIC_NOTES = new Set(["needs_clarification", "delivered", "closed"]);

export function simplifiedRequestStatus(stage: string) {
  if (["submitted", "pending_approval", "under_review", "scoping", "proposal", "approved"].includes(stage)) return "Planning";
  if (stage === "needs_clarification") return "Waiting for your response";
  if (["in_progress", "in_review"].includes(stage)) return "Work in progress";
  if (stage === "delivered") return "Ready for review";
  if (stage === "closed") return "Completed";
  if (["on_hold", "cancelled", "rejected"].includes(stage)) return "Not active";
  return "Received";
}

export class ClientTrackingService {
  static async findRequest(token: string) {
    const request = await db.request.findUnique({
      where: { publicToken: token },
      include: {
        routedTeam: { select: { name: true, leadId: true } },
        project: {
          include: {
            clientDecisions: { orderBy: { createdAt: "desc" }, take: 1 },
            tasks: {
              select: {
                id: true,
                deliverables: {
                  where: { visibility: "client" },
                  include: { versions: { orderBy: { revision: "desc" }, take: 1 } },
                },
              },
            },
          },
        },
        stageEvents: {
          orderBy: { createdAt: "asc" },
          select: { id: true, toStage: true, note: true, createdAt: true },
        },
        comments: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
          include: { author: { select: { name: true } } },
        },
      },
    });
    if (
      !request ||
      request.publicTokenRevokedAt ||
      (request.publicTokenExpiresAt && request.publicTokenExpiresAt <= new Date())
    ) {
      throw new TRPCError({ code: "NOT_FOUND", message: "This tracking link is invalid or has expired." });
    }
    return request;
  }

  static project(request: Awaited<ReturnType<typeof ClientTrackingService.findRequest>>) {
    const deliverables = request.project?.tasks.flatMap((task) =>
      task.deliverables.flatMap((deliverable) => {
        const current = deliverable.versions[0];
        return current ? [{
          id: deliverable.id,
          title: deliverable.title,
          kind: deliverable.kind,
          revision: current.revision,
          url: current.url,
          content: current.content,
          notes: current.notes,
          deliveredAt: current.createdAt,
        }] : [];
      }),
    ) ?? [];

    return {
      code: request.code,
      title: request.title,
      status: simplifiedRequestStatus(request.stage),
      stage: request.stage,
      teamName: request.routedTeam?.name ?? null,
      targetDeliveryDate: request.project?.targetDeliveryDate ?? request.deadline,
      canReviewDelivery: request.project?.status === "delivered",
      latestDecision: request.project?.clientDecisions[0]?.decision ?? null,
      timeline: request.stageEvents.map((event) => ({
        id: event.id,
        status: simplifiedRequestStatus(event.toStage),
        note: PUBLIC_NOTES.has(event.toStage) ? event.note : null,
        createdAt: event.createdAt,
      })),
      messages: request.comments.map((comment) => ({
        id: comment.id,
        body: comment.body,
        createdAt: comment.createdAt,
        authorName: comment.author?.name ?? "Client",
        fromTeam: Boolean(comment.authorId),
      })),
      deliverables,
    };
  }

  static async decide(args: { token: string; decision: "accepted" | "changes_requested"; message?: string }) {
    const request = await this.findRequest(args.token);
    const project = request.project;
    if (!project || project.status !== "delivered" || request.stage !== "delivered") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This delivery is not awaiting client review." });
    }
    if (args.decision === "changes_requested" && !args.message?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Describe the changes you need." });
    }

    const taskIds = project.tasks
      .filter((task) => task.deliverables.length > 0)
      .map((task) => task.id);

    await db.$transaction(async (tx) => {
      await tx.clientDecision.create({
        data: {
          projectId: project.id,
          decision: args.decision,
          projectRevision: project.clientRevision,
          message: args.message?.trim() || null,
        },
      });
      if (args.decision === "accepted") {
        await tx.project.update({ where: { id: project.id }, data: { status: "closed" } });
        await tx.request.update({ where: { id: request.id }, data: { stage: "closed" } });
        await tx.requestStageEvent.create({ data: { requestId: request.id, fromStage: "delivered", toStage: "closed", note: "Delivery accepted by client." } });
      } else {
        await tx.project.update({ where: { id: project.id }, data: { status: "in_review", clientRevision: { increment: 1 } } });
        await tx.request.update({ where: { id: request.id }, data: { stage: "in_review" } });
        await tx.requestStageEvent.create({ data: { requestId: request.id, fromStage: "delivered", toStage: "in_review", note: "Client requested changes." } });
        const reopenIds = taskIds.length ? taskIds : project.tasks.map((task) => task.id);
        await tx.task.updateMany({
          where: { id: { in: reopenIds }, status: "done" },
          data: { status: "in_progress", completedAt: null, reviewedAt: null, reviewedById: null, reopenedCount: { increment: 1 }, revision: { increment: 1 } },
        });
      }
    });

    const recipients = [project.pmUserId, request.routedTeam?.leadId].filter((id): id is string => Boolean(id));
    if (recipients.length) {
      await NotificationService.createMany(Array.from(new Set(recipients)), {
        kind: "request_state_changed",
        title: args.decision === "accepted" ? `${request.code} accepted` : `Changes requested on ${request.code}`,
        body: args.message?.trim() || "The client accepted the delivered work.",
        link: `/projects/${project.id}`,
        entityType: "Project",
        entityId: project.id,
      });
    }
    await AuditService.log({
      actorId: null,
      organizationId: request.organizationId,
      action: `client.${args.decision}`,
      entityType: "Project",
      entityId: project.id,
      after: { revision: project.clientRevision, message: args.message?.trim() || null },
    });
    return { ok: true, status: args.decision === "accepted" ? "closed" : "in_review" };
  }
}
