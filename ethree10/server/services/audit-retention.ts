import { subDays } from "date-fns";
import { z } from "zod";
import { db } from "@/server/db/client";

const retentionInput = z.object({
  days: z.number().int().min(30).max(3650).default(730),
  batchSize: z.number().int().min(1).max(1000).default(500),
  dryRun: z.boolean().default(true),
  now: z.date().default(() => new Date()),
});

export type AuditRetentionInput = z.input<typeof retentionInput>;

export type AuditRetentionResult = {
  cutoff: Date;
  staleCount: number;
  archivedCount: number;
  deletedCount: number;
  dryRun: boolean;
};

export function resolveAuditRetentionOptions(input: AuditRetentionInput = {}) {
  const options = retentionInput.parse(input);
  return {
    ...options,
    cutoff: subDays(options.now, options.days),
  };
}

export class AuditRetentionService {
  static async archiveStaleLogs(input: AuditRetentionInput = {}): Promise<AuditRetentionResult> {
    const options = resolveAuditRetentionOptions(input);
    const where = { createdAt: { lt: options.cutoff } };
    const staleCount = await db.auditLog.count({ where });

    if (options.dryRun || staleCount === 0) {
      return {
        cutoff: options.cutoff,
        staleCount,
        archivedCount: 0,
        deletedCount: 0,
        dryRun: options.dryRun,
      };
    }

    const staleLogs = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: options.batchSize,
    });

    const archivedCount = await db.$transaction(async (tx) => {
      await tx.archivedAuditLog.createMany({
        data: staleLogs.map((log) => ({
          id: log.id,
          actorId: log.actorId,
          action: log.action,
          entityType: log.entityType,
          entityId: log.entityId,
          changes: { before: log.before, after: log.after },
          createdAt: log.createdAt,
        })),
        skipDuplicates: true,
      });

      const deleted = await tx.auditLog.deleteMany({
        where: { id: { in: staleLogs.map((log) => log.id) } },
      });

      return deleted.count;
    });

    return {
      cutoff: options.cutoff,
      staleCount,
      archivedCount,
      deletedCount: archivedCount,
      dryRun: false,
    };
  }
}
