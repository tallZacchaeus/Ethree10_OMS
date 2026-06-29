import { db } from "@/server/db/client";

export interface AuditEntry {
  actorId: string | null;
  // Audit is agency-global now; any org/workspace hint passed by callers is accepted but
  // ignored (kept optional so existing call sites compile without churn).
  workspaceId?: string | null;
  organizationId?: string | null;
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
    entityType?: string;
    entityId?: string;
    limit?: number;
  }) {
    return db.auditLog.findMany({
      where: {
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
