import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { RequestStage, Urgency } from "@prisma/client";
import { router, publicProcedure } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { can } from "@/server/auth/permissions";
import { RequestService } from "@/server/services/request";
import { posthogServer } from "@/lib/posthog";
import {
  getAgencyAuthContext,
  requireAgencyAction,
} from "@/server/services/agency";

const createInput = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  projectType: z.string().min(2),
  urgency: z.nativeEnum(Urgency).default("medium"),
  deadline: z.date().optional(),
  primaryContact: z.string().optional(),
  budgetEstimate: z.number().nonnegative().optional(),
  currency: z.string().optional(),
  serviceId: z.string().optional(),
  expectedOutcome: z.string().trim().min(10).optional(),
  expectedDeliverables: z.string().trim().min(3).optional(),
  acceptanceCriteria: z.string().trim().min(3).optional(),
  supportingLinks: z.array(z.string().url()).max(10).optional(),
  consentToEmail: z.boolean().default(false),
});

/**
 * A request is readable by agency staff (any request) or by members of the
 * request's own organization (their own org's requests). Returns the loaded
 * request so callers can avoid a second fetch.
 */
async function assertCanReadRequest(userId: string, requestId: string) {
  const request = await db.request.findUnique({ where: { id: requestId } });
  if (!request) throw new TRPCError({ code: "NOT_FOUND" });

  const agencyCtx = await getAgencyAuthContext(userId);
  if (can(agencyCtx, "request.read")) {
    if (agencyCtx.isSuperAdmin || agencyCtx.roles.includes("agency_admin") || agencyCtx.roles.includes("finance_admin")) {
      return request;
    }
    if (request.routedTeamId) {
      const membership = await db.membership.findFirst({
        where: { userId, teamId: request.routedTeamId, removedAt: null, acceptedAt: { not: null } }
      });
      if (membership) return request;
    }
  }

  if (request.submittedById === userId) return request;

  throw new TRPCError({ code: "FORBIDDEN" });
}

async function visibleTeamIds(userId: string): Promise<string[] | null> {
  const auth = await getAgencyAuthContext(userId);
  if (auth.isSuperAdmin || auth.roles.includes("agency_admin") || auth.roles.includes("finance_admin")) return null;
  const memberships = await db.membership.findMany({
    where: { userId, removedAt: null, acceptedAt: { not: null }, teamId: { not: null } },
    select: { teamId: true },
  });
  return memberships.flatMap((membership) => membership.teamId ? [membership.teamId] : []);
}

export const requestsRouter = router({
  // Public marketing-site intake → creates a real Request under a lightweight
  // external client org and returns the tracking token (no login required).
  publicSubmit: publicProcedure
    .input(
      z.object({
        requesterName: z.string().min(2),
        requesterEmail: z.string().email(),
        requesterPhone: z.string().optional(),
        organizationName: z.string().optional(),
        title: z.string().min(3),
        description: z.string().min(10),
        projectType: z.string().min(2),
        serviceId: z.string(),
        urgency: z.nativeEnum(Urgency).default("medium"),
        deadline: z.coerce.date().optional(),
        budgetEstimate: z.number().nonnegative().optional(),
        expectedOutcome: z.string().trim().min(10),
        expectedDeliverables: z.string().trim().min(3),
        acceptanceCriteria: z.string().trim().min(3),
        supportingLinks: z.array(z.string().url()).max(10).default([]),
        consentToEmail: z.literal(true),
      }),
    )
    .mutation(async ({ input }) => {
      const result = await RequestService.createPublic({
        requesterName: input.requesterName,
        requesterEmail: input.requesterEmail,
        requesterPhone: input.requesterPhone,
        organizationName: input.organizationName,
        input: {
          title: input.title,
          description: input.description,
          projectType: input.projectType,
          serviceId: input.serviceId,
          urgency: input.urgency,
          deadline: input.deadline,
          budgetEstimate: input.budgetEstimate,
          primaryContact: input.requesterName,
          expectedOutcome: input.expectedOutcome,
          expectedDeliverables: input.expectedDeliverables,
          acceptanceCriteria: input.acceptanceCriteria,
          supportingLinks: input.supportingLinks,
          consentToEmail: input.consentToEmail,
        },
      });
      return { code: result.code, publicToken: result.publicToken };
    }),

  list: protectedProcedure
    .input(
      z
        .object({
          organizationId: z.string().optional(),
          stage: z.nativeEnum(RequestStage).optional(),
          routedTeamId: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
    )
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "request.read");
      const teamIds = await visibleTeamIds(ctx.userId);
      return db.request.findMany({
        where: {
          organizationId: input.organizationId,
          stage: input.stage,
          routedTeamId: teamIds === null ? input.routedTeamId : { in: teamIds },
        },
        take: input.limit,
        orderBy: { createdAt: "desc" },
      });
    }),

  myRequests: protectedProcedure.query(async ({ ctx }) => {
    return RequestService.listSubmittedBy(ctx.userId);
  }),

  inbox: protectedProcedure
    .input(
      z
        .object({
          stage: z.nativeEnum(RequestStage).optional(),
          routedTeamId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "request.read");
      const teamIds = await visibleTeamIds(ctx.userId);
      if (teamIds === null) return RequestService.inbox({ stage: input?.stage, routedTeamId: input?.routedTeamId });
      return db.request.findMany({
        where: {
          stage: input?.stage ?? { in: ["submitted", "needs_clarification", "under_review", "scoping"] },
          routedTeamId: { in: teamIds },
        },
        include: RequestService.requestInclude,
        orderBy: [{ urgency: "desc" }, { createdAt: "asc" }],
      });
    }),

  /** Agency teams available as routing targets. */
  agencyTeams: protectedProcedure.query(async ({ ctx }) => {
    await requireAgencyAction(ctx.userId, "request.read");
    return db.team.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, slug: true, color: true },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanReadRequest(ctx.userId, input.id);
      const request = await RequestService.getById(input.id);

      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      if (!can(agencyCtx, "request.read")) {
        request.comments = request.comments.filter((c) => !c.isInternal);
      }
      
      return request;
    }),

  create: protectedProcedure.input(createInput.extend({ organizationId: z.string() })).mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "request.create");
      const { organizationId, ...rest } = input;
      const request = await RequestService.create({
        actorId: ctx.userId,
        organizationId: organizationId,
        input: rest,
      });

      posthogServer.capture({
        distinctId: ctx.userId,
        event: "request_submitted",
        properties: { requestId: request.id, organizationId: organizationId },
      });

      return request;
  }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(3).optional(),
        description: z.string().min(10).optional(),
        urgency: z.nativeEnum(Urgency).optional(),
        deadline: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await assertCanReadRequest(ctx.userId, input.id);
      // Requester can edit their own draft; agency staff can always edit.
      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      const isOwner = request.submittedById === ctx.userId;
      if (!isOwner && !can(agencyCtx, "request.update")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const { id, ...patch } = input;
      return RequestService.update({ actorId: ctx.userId, requestId: id, patch });
    }),

  route: protectedProcedure
    .input(z.object({ id: z.string(), teamId: z.string(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanReadRequest(ctx.userId, input.id);
      await requireAgencyAction(ctx.userId, "request.route");
      const result = await RequestService.route({
        actorId: ctx.userId,
        requestId: input.id,
        teamId: input.teamId,
        note: input.note,
      });

      posthogServer.capture({
        distinctId: ctx.userId,
        event: "request_routed",
        properties: { requestId: input.id, teamId: input.teamId },
      });

      return result;
    }),

  transition: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        toStage: z.nativeEnum(RequestStage),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanReadRequest(ctx.userId, input.id);
      await requireAgencyAction(ctx.userId, "request.transition");
      return RequestService.transition({
        actorId: ctx.userId,
        requestId: input.id,
        toStage: input.toStage,
        note: input.note,
      });
    }),

  approve: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanReadRequest(ctx.userId, input.id);
      await requireAgencyAction(ctx.userId, "request.approve");
      return RequestService.approve({ actorId: ctx.userId, requestId: input.id });
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().min(2) }))
    .mutation(async ({ ctx, input }) => {
      await assertCanReadRequest(ctx.userId, input.id);
      await requireAgencyAction(ctx.userId, "request.reject");
      return RequestService.reject({
        actorId: ctx.userId,
        requestId: input.id,
        reason: input.reason,
      });
    }),

  cancel: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const request = await assertCanReadRequest(ctx.userId, input.id);
      const isOwner = request.submittedById === ctx.userId;
      if (!isOwner) {
        await requireAgencyAction(ctx.userId, "request.transition");
      }
      return RequestService.transition({
        actorId: ctx.userId,
        requestId: input.id,
        toStage: "cancelled",
        note: input.reason,
      });
    }),

  comment: protectedProcedure
    .input(
      z.object({
        requestId: z.string(),
        body: z.string().min(1),
        isInternal: z.boolean().default(false),
        mentions: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const request = await assertCanReadRequest(ctx.userId, input.requestId);
      // Staff need comment.create; the request's own submitter may always comment on it.
      // Read-only viewers (client_viewer) who aren't the submitter are blocked.
      if (request.submittedById !== ctx.userId) {
        const agencyCtx = await getAgencyAuthContext(ctx.userId);
        if (!can(agencyCtx, "comment.create")) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Missing permission: comment.create" });
        }
      }
      return RequestService.addComment({
        actorId: ctx.userId,
        requestId: input.requestId,
        body: input.body,
        isInternal: input.isInternal,
        mentions: input.mentions,
      });
    }),
});
