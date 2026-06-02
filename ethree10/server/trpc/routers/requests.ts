import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { RequestStage, Urgency } from "@prisma/client";
import { router, publicProcedure } from "../trpc";
import { protectedProcedure, workspaceProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { can } from "@/server/auth/permissions";
import { RequestService } from "@/server/services/request";
import { LeadService } from "@/server/services/lead";
import { posthogServer } from "@/lib/posthog";
import {
  getAgencyAuthContext,
  getAgencyWorkspaceId,
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
});

/**
 * A request is readable by agency staff (any request) or by members of the
 * request's own workspace (their own org's requests). Returns the loaded
 * request so callers can avoid a second fetch.
 */
async function assertCanReadRequest(userId: string, requestId: string) {
  const request = await db.request.findUnique({ where: { id: requestId } });
  if (!request) throw new TRPCError({ code: "NOT_FOUND" });

  const agencyCtx = await getAgencyAuthContext(userId);
  if (can(agencyCtx, "request.read")) return request;

  if (request.submittedById === userId) return request;

  const membership = await db.membership.findFirst({
    where: {
      userId,
      workspaceId: request.workspaceId,
      removedAt: null,
      acceptedAt: { not: null },
    },
    select: { id: true },
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
  return request;
}

export const requestsRouter = router({
  // Public marketing-site intake → creates a Lead the agency triages.
  publicSubmit: publicProcedure
    .input(
      z.object({
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        organization: z.string().optional(),
        message: z.string().min(10),
        source: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await LeadService.create(input);
      return { ok: true };
    }),

  list: workspaceProcedure
    .input(
      z
        .object({
          stage: z.nativeEnum(RequestStage).optional(),
          routedDepartmentId: z.string().optional(),
          limit: z.number().min(1).max(100).default(50),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await ctx.authorize("request.read");
      return RequestService.listForWorkspace(ctx.workspaceId, {
        stage: input?.stage,
        routedDepartmentId: input?.routedDepartmentId,
        limit: input?.limit,
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
          routedDepartmentId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "request.read");
      return RequestService.inbox({
        stage: input?.stage,
        routedDepartmentId: input?.routedDepartmentId,
      });
    }),

  /** Agency departments available as routing targets. */
  agencyDepartments: protectedProcedure.query(async ({ ctx }) => {
    await requireAgencyAction(ctx.userId, "request.read");
    const agencyId = await getAgencyWorkspaceId();
    if (!agencyId) return [];
    return db.department.findMany({
      where: { workspaceId: agencyId, archivedAt: null },
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

  create: workspaceProcedure.input(createInput).mutation(async ({ ctx, input }) => {
    await ctx.authorize("request.create");
    const request = await RequestService.create({
      actorId: ctx.userId,
      workspaceId: ctx.workspaceId,
      input,
    });
    
    posthogServer.capture({
      distinctId: ctx.userId,
      event: "request_submitted",
      properties: { requestId: request.id, workspaceId: ctx.workspaceId },
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
    .input(z.object({ id: z.string(), departmentId: z.string(), note: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "request.route");
      const result = await RequestService.route({
        actorId: ctx.userId,
        requestId: input.id,
        departmentId: input.departmentId,
        note: input.note,
      });

      posthogServer.capture({
        distinctId: ctx.userId,
        event: "request_routed",
        properties: { requestId: input.id, departmentId: input.departmentId },
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
      await requireAgencyAction(ctx.userId, "request.approve");
      return RequestService.approve({ actorId: ctx.userId, requestId: input.id });
    }),

  reject: protectedProcedure
    .input(z.object({ id: z.string(), reason: z.string().min(2) }))
    .mutation(async ({ ctx, input }) => {
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
      await assertCanReadRequest(ctx.userId, input.requestId);
      return RequestService.addComment({
        actorId: ctx.userId,
        requestId: input.requestId,
        body: input.body,
        isInternal: input.isInternal,
        mentions: input.mentions,
      });
    }),
});
