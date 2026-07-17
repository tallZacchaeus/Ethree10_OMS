import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { TaskStatus, TaskPriority } from "@prisma/client";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { posthogServer } from "@/lib/posthog";
import { db } from "@/server/db/client";
import { TaskService } from "@/server/services/task";
import { ProjectService } from "@/server/services/project";
import { requireAgencyAction, getAgencyAuthContext } from "@/server/services/agency";
import { can } from "@/server/auth/permissions";

async function loadTaskForRead(userId: string, taskId: string) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, assigneeUserId: true },
  });
  if (!task) throw new TRPCError({ code: "NOT_FOUND" });
  if (task.assigneeUserId === userId) return task;
  if (await ProjectService.canRead(userId, task.projectId)) return task;
  throw new TRPCError({ code: "FORBIDDEN" });
}

export const tasksRouter = router({
  listForProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      if (!(await ProjectService.canRead(ctx.userId, input.projectId))) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return TaskService.listForProject(input.projectId);
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await loadTaskForRead(ctx.userId, input.id);
      return TaskService.getById(input.id);
    }),

  myTasks: protectedProcedure.query(async ({ ctx }) => {
    return TaskService.listAssignedTo(ctx.userId);
  }),

  subUnitsForProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "task.create");
      const project = await db.project.findUnique({
        where: { id: input.projectId },
        select: { agencyTeamId: true },
      });
      if (!project?.agencyTeamId) return [];
      return db.subUnit.findMany({
        where: { teamId: project.agencyTeamId, archivedAt: null },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
    }),

  candidates: protectedProcedure
    .input(z.object({ subUnitId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "task.assign");
      return TaskService.candidates(input.subUnitId);
    }),

  create: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(2),
        description: z.string().optional(),
        subUnitId: z.string().optional(),
        assigneeUserId: z.string().optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        estimatedHours: z.number().nonnegative().optional(),
        dueDate: z.date().optional(),
        dependsOn: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!(await ProjectService.canRead(ctx.userId, input.projectId))) throw new TRPCError({ code: "FORBIDDEN" });
      await requireAgencyAction(ctx.userId, "task.create");
      return TaskService.create({ actorId: ctx.userId, input });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(2).optional(),
        description: z.string().optional(),
        priority: z.nativeEnum(TaskPriority).optional(),
        estimatedHours: z.number().nonnegative().optional(),
        dueDate: z.date().nullable().optional(),
        subUnitId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await loadTaskForRead(ctx.userId, input.id);
      if (task.assigneeUserId !== ctx.userId) {
        await requireAgencyAction(ctx.userId, "task.update");
      }
      const { id, ...patch } = input;
      return TaskService.update({ actorId: ctx.userId, taskId: id, patch });
    }),

  assign: protectedProcedure
    .input(z.object({ taskId: z.string(), assigneeUserId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await loadTaskForRead(ctx.userId, input.taskId);
      await requireAgencyAction(ctx.userId, "task.assign");
      const result = await TaskService.assign({
        actorId: ctx.userId,
        taskId: input.taskId,
        assigneeUserId: input.assigneeUserId,
      });

      posthogServer.capture({
        distinctId: ctx.userId,
        event: "task_assigned",
        properties: { taskId: input.taskId, assigneeUserId: input.assigneeUserId },
      });

      return result;
    }),

  transition: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        toStatus: z.nativeEnum(TaskStatus),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await loadTaskForRead(ctx.userId, input.taskId);
      if (task.assigneeUserId !== ctx.userId) {
        await requireAgencyAction(ctx.userId, "task.update");
      }
      return TaskService.transition({
        actorId: ctx.userId,
        taskId: input.taskId,
        toStatus: input.toStatus,
        note: input.note,
      });
    }),

  submitCompletion: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        summary: z.string().min(2),
        evidence: z.string().optional(),
        hoursLogged: z.number().nonnegative().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const task = await loadTaskForRead(ctx.userId, input.taskId);
      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      const isAssignee = task.assigneeUserId === ctx.userId;
      if (!isAssignee && !can(agencyCtx, "task.submitCompletion")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const result = await TaskService.submitCompletion({
        actorId: ctx.userId,
        taskId: input.taskId,
        summary: input.summary,
        evidence: input.evidence,
        hoursLogged: input.hoursLogged,
      });

      posthogServer.capture({
        distinctId: ctx.userId,
        event: "task_completed",
        properties: { taskId: input.taskId, projectId: task.projectId },
      });

      return result;
    }),

  review: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        decision: z.enum(["accept", "request_changes"]),
        note: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await loadTaskForRead(ctx.userId, input.taskId);
      await requireAgencyAction(ctx.userId, "task.review");
      return TaskService.review({
        actorId: ctx.userId,
        taskId: input.taskId,
        decision: input.decision,
        note: input.note,
      });
    }),

  reopen: protectedProcedure
    .input(z.object({ taskId: z.string(), reason: z.string().min(2) }))
    .mutation(async ({ ctx, input }) => {
      await loadTaskForRead(ctx.userId, input.taskId);
      await requireAgencyAction(ctx.userId, "task.review");
      return TaskService.reopen({
        actorId: ctx.userId,
        taskId: input.taskId,
        reason: input.reason,
      });
    }),

  comment: protectedProcedure
    .input(
      z.object({
        taskId: z.string(),
        body: z.string().min(1),
        isInternal: z.boolean().default(false),
        mentions: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await loadTaskForRead(ctx.userId, input.taskId);
      // Task comments are internal — require comment.create (granted to staff + executive).
      const agencyCtx = await getAgencyAuthContext(ctx.userId);
      if (!can(agencyCtx, "comment.create")) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Missing permission: comment.create" });
      }
      return TaskService.addComment({
        actorId: ctx.userId,
        taskId: input.taskId,
        body: input.body,
        isInternal: input.isInternal,
        mentions: input.mentions,
      });
    }),
});
