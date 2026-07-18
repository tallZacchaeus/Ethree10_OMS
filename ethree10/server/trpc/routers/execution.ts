import { z } from "zod";
import { AvailabilityType, DeliverableKind, DeliverableVisibility } from "@prisma/client";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { requireAgencyAction } from "@/server/services/agency";
import { ProjectService } from "@/server/services/project";
import { ExecutionService } from "@/server/services/execution";
import { db } from "@/server/db/client";
import { TRPCError } from "@trpc/server";

async function requireTaskAccess(userId: string, taskId: string) {
  const task = await db.task.findUnique({ where: { id: taskId }, select: { projectId: true, assigneeUserId: true } });
  if (!task) throw new TRPCError({ code: "NOT_FOUND" });
  if (task.assigneeUserId === userId || await ProjectService.canRead(userId, task.projectId)) return task;
  throw new TRPCError({ code: "FORBIDDEN" });
}

async function requireTeamAccess(userId: string, teamId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { isSuperAdmin: true } });
  const broadRole = await db.membership.findFirst({
    where: { userId, role: { in: ["agency_admin", "finance_admin"] }, acceptedAt: { not: null }, removedAt: null },
  });
  if (user?.isSuperAdmin || broadRole) return;
  const membership = await db.membership.findFirst({
    where: { userId, teamId, acceptedAt: { not: null }, removedAt: null },
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "You cannot access another team's execution data." });
}

export const executionRouter = router({
  setContributors: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      contributors: z.array(z.object({
        userId: z.string(),
        contributionRole: z.string().trim().min(2),
        positionId: z.string().optional(),
        isPrimary: z.boolean().optional(),
      })).min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireTaskAccess(ctx.userId, input.taskId);
      await requireAgencyAction(ctx.userId, "task.assign");
      return ExecutionService.setContributors({ actorId: ctx.userId, ...input });
    }),

  recordAvailability: protectedProcedure
    .input(z.object({
      userId: z.string(),
      type: z.nativeEnum(AvailabilityType),
      startsAt: z.date(),
      endsAt: z.date(),
      capacityPercent: z.number().int().min(0).max(100).default(100),
      reason: z.string().trim().max(500).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId !== ctx.userId) await requireAgencyAction(ctx.userId, "team.update");
      return ExecutionService.recordAvailability({ actorId: ctx.userId, ...input });
    }),

  workload: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "task.read");
      await requireTeamAccess(ctx.userId, input.teamId);
      return ExecutionService.workload(input.teamId);
    }),

  createDeliverable: protectedProcedure
    .input(z.object({
      taskId: z.string(),
      title: z.string().trim().min(2),
      kind: z.nativeEnum(DeliverableKind),
      visibility: z.nativeEnum(DeliverableVisibility).default("internal"),
      url: z.string().url().optional(),
      content: z.string().trim().min(1).optional(),
      notes: z.string().trim().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireTaskAccess(ctx.userId, input.taskId);
      return ExecutionService.createDeliverable({ actorId: ctx.userId, ...input });
    }),

  addDeliverableVersion: protectedProcedure
    .input(z.object({
      deliverableId: z.string(),
      url: z.string().url().optional(),
      content: z.string().trim().min(1).optional(),
      notes: z.string().trim().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const deliverable = await db.deliverable.findUnique({ where: { id: input.deliverableId }, select: { taskId: true } });
      if (!deliverable) throw new TRPCError({ code: "NOT_FOUND" });
      await requireTaskAccess(ctx.userId, deliverable.taskId);
      return ExecutionService.addDeliverableVersion({ actorId: ctx.userId, ...input });
    }),

  reviewQueue: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "task.review");
      await requireTeamAccess(ctx.userId, input.teamId);
      return ExecutionService.reviewQueue(input.teamId);
    }),

  assignments: protectedProcedure
    .input(z.object({ teamId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "task.read");
      await requireTeamAccess(ctx.userId, input.teamId);
      return ExecutionService.assignments(input.teamId);
    }),
});
