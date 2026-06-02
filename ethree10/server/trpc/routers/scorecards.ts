import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { requireAgencyAction } from "@/server/services/agency";
import { ReportLevel } from "@prisma/client";

export const scorecardsRouter = router({
  list: protectedProcedure
    .input(z.object({ workspaceId: z.string() }))
    .query(async ({ input }) => {
      return db.scorecardConfig.findMany({
        where: { workspaceId: input.workspaceId },
      });
    }),

  getById: protectedProcedure
    .input(z.string())
    .query(async ({ input }) => {
      return db.scorecardConfig.findUnique({
        where: { id: input },
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        level: z.nativeEnum(ReportLevel),
        scopeId: z.string(),
        name: z.string(),
        items: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            weight: z.number(),
            evidence: z.string(),
            target: z.number(),
            scoringFn: z.enum(["linearAboveTarget", "boolean", "linearBelowTarget"]),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "department.update");
      return db.scorecardConfig.create({
        data: {
          workspaceId: input.workspaceId,
          level: input.level,
          scopeId: input.scopeId,
          name: input.name,
          items: input.items,
        },
      });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        items: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            weight: z.number(),
            evidence: z.string(),
            target: z.number(),
            scoringFn: z.enum(["linearAboveTarget", "boolean", "linearBelowTarget"]),
          })
        ).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "department.update");
      return db.scorecardConfig.update({
        where: { id: input.id },
        data: {
          name: input.name,
          items: input.items,
          isActive: input.isActive,
        },
      });
    }),
});
