import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { AuditService } from "@/server/services/audit";
import { requireAgencyAction } from "@/server/services/agency";

export const auditRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          entityType: z.string().optional(),
          entityId: z.string().optional(),
          workspaceId: z.string().optional(),
          limit: z.number().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "audit.read");
      return AuditService.list({
        entityType: input?.entityType,
        entityId: input?.entityId,
        workspaceId: input?.workspaceId,
        limit: input?.limit,
      });
    }),

  archiveStaleLogs: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Must have agency admin access
      await requireAgencyAction(ctx.userId, "audit.read");
      const { db } = await import("@/server/db/client");
      const { subMonths } = await import("date-fns");

      const cutoff = subMonths(new Date(), 24);
      
      const staleLogs = await db.auditLog.findMany({
        where: { createdAt: { lt: cutoff } },
      });

      if (staleLogs.length === 0) {
        return { archivedCount: 0 };
      }

      await db.$transaction(async (tx) => {
        await tx.archivedAuditLog.createMany({
          data: staleLogs.map(log => ({
            id: log.id,
            workspaceId: log.workspaceId,
            actorId: log.actorId,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            changes: { before: log.before, after: log.after },
            createdAt: log.createdAt,
          })),
        });

        await tx.auditLog.deleteMany({
          where: { id: { in: staleLogs.map(l => l.id) } },
        });
      });

      return { archivedCount: staleLogs.length };
    }),
});
