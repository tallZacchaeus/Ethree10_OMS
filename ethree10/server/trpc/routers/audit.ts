import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { AuditService } from "@/server/services/audit";
import { AuditRetentionService } from "@/server/services/audit-retention";
import { requireAgencyAction } from "@/server/services/agency";

export const auditRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          entityType: z.string().optional(),
          entityId: z.string().optional(),
          limit: z.number().min(1).max(200).default(100),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "audit.read");
      return AuditService.list({
        entityType: input?.entityType,
        entityId: input?.entityId,
        limit: input?.limit,
      });
    }),

  archiveStaleLogs: protectedProcedure
    .mutation(async ({ ctx }) => {
      await requireAgencyAction(ctx.userId, "audit.read");
      return AuditRetentionService.archiveStaleLogs({ days: 730, dryRun: false });
    }),
});
