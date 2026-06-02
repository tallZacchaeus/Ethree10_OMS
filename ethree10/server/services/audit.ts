import { db } from "@/server/db/client";

export interface AuditEntry {
  actorId: string | null;
  workspaceId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

export class AuditService {
  static async log(entry: AuditEntry): Promise<void> {
    await db.auditLog.create({
      data: {
        actorId: entry.actorId,
        workspaceId: entry.workspaceId ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        before: entry.before as never,
        after: entry.after as never,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }

  static async list(opts: {
    workspaceId?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
  }) {
    return db.auditLog.findMany({
      where: {
        workspaceId: opts.workspaceId,
        entityType: opts.entityType,
        entityId: opts.entityId,
      },
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 100,
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
