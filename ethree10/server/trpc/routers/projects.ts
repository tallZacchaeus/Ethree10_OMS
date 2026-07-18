import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { ProjectStatus } from "@prisma/client";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { ProjectService } from "@/server/services/project";
import { requireAgencyAction } from "@/server/services/agency";
import { db } from "@/server/db/client";

async function assertCanReadProject(userId: string, projectId: string) {
  if (!(await ProjectService.canRead(userId, projectId))) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

export const projectsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.nativeEnum(ProjectStatus).optional(),
          teamId: z.string().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      return ProjectService.listVisibleTo(ctx.userId, {
        status: input?.status,
        teamId: input?.teamId,
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertCanReadProject(ctx.userId, input.id);
      return ProjectService.getById(input.id);
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        status: z.nativeEnum(ProjectStatus).optional(),
        pmUserId: z.string().optional(),
        targetDeliveryDate: z.date().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanReadProject(ctx.userId, input.id);
      await requireAgencyAction(ctx.userId, "project.update");
      const { id, ...patch } = input;
      return ProjectService.update({ actorId: ctx.userId, projectId: id, patch });
    }),

  deliver: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertCanReadProject(ctx.userId, input.id);
      await requireAgencyAction(ctx.userId, "project.update");
      return ProjectService.deliver({ actorId: ctx.userId, projectId: input.id });
    }),

  recordCsat: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        score: z.number().int().min(1).max(5),
        comment: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await assertCanReadProject(ctx.userId, input.projectId);
      return ProjectService.recordCsat({
        actorId: ctx.userId,
        projectId: input.projectId,
        score: input.score,
        comment: input.comment,
      });
    }),

  getKnowledgeBase: protectedProcedure
    .input(z.object({ query: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      // Must have agency access
      await requireAgencyAction(ctx.userId, "organization.read");

      const projects = await db.project.findMany({
        where: {
          status: { in: ["delivered", "closed"] },
          OR: input?.query
            ? [
                { name: { contains: input.query, mode: "insensitive" } },
                { description: { contains: input.query, mode: "insensitive" } },
              ]
            : undefined,
        },
        include: {
          team: true,
          organization: true,
          tasks: {
            where: { status: "done" },
            select: { id: true, title: true, status: true },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 50,
      });

      return projects;
    }),
});
