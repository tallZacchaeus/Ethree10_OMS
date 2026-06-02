import type { NotificationKind } from "@prisma/client";
import { db } from "@/server/db/client";
import { EmailService } from "@/server/notifications/email";
import { TwilioService } from "@/server/notifications/twilio";

const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 60 minutes

// Kinds that also send an email by default (task_due_soon is in-app only).
const EMAIL_KINDS = new Set<NotificationKind>([
  "request_submitted",
  "request_assigned",
  "request_state_changed",
  "task_assigned",
  "task_overdue",
  "task_completed",
  "mention",
  "proposal_sent",
  "proposal_accepted",
  "report_ready",
  "approval_requested",
  "integration_degraded",
  "csat_received",
]);

export interface CreateNotificationArgs {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}

/**
 * In-app notification writes. Email/WhatsApp delivery is layered on in Sprint 5
 * by enqueuing a delivery job off the row created here.
 */
export class NotificationService {
  static async create(args: CreateNotificationArgs) {
    if (args.entityId && args.entityType) {
      const recent = await db.notification.findFirst({
        where: {
          userId: args.userId,
          kind: args.kind,
          entityType: args.entityType,
          entityId: args.entityId,
          createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
        },
      });
      if (recent) return recent;
    }
    const notification = await db.notification.create({
      data: {
        userId: args.userId,
        kind: args.kind,
        title: args.title,
        body: args.body ?? null,
        link: args.link ?? null,
        entityType: args.entityType ?? null,
        entityId: args.entityId ?? null,
      },
    });

    const user = await db.user.findUnique({
      where: { id: args.userId },
      select: { email: true, phone: true, phoneVerifiedAt: true, deactivatedAt: true, timezone: true },
    });

    if (user && !user.deactivatedAt) {
      // Check preferences
      let prefs = await db.notificationPreference.findUnique({
        where: { userId_kind: { userId: args.userId, kind: args.kind } },
      });

      if (!prefs) {
        // Default preferences
        prefs = {
          email: EMAIL_KINDS.has(args.kind),
          push: true,
          whatsapp: false, // Default false until they verify
        } as any;
      }

      const updates: any = {};

      if (prefs!.email && user.email) {
        const sent = await EmailService.sendNotification({
          to: user.email,
          title: args.title,
          body: args.body ?? undefined,
          ctaPath: args.link ?? undefined,
        });
        if (sent) updates.emailedAt = new Date();
      }

      if (prefs!.whatsapp && user.phone && user.phoneVerifiedAt) {
        // Quiet hours check (8am - 8pm in user timezone)
        // For simplicity, we just send it if we're not strict, or you could queue it.
        // Let's do a basic timezone hour check if possible, or just send.
        const d = new Date();
        const userTimeStr = d.toLocaleString("en-US", { timeZone: user.timezone || "Africa/Lagos" });
        const userHour = new Date(userTimeStr).getHours();
        
        if (userHour >= 8 && userHour <= 20) {
          const body = `*${args.title}*\n${args.body || ""}\n${args.link ? `Link: ${args.link}` : ""}`;
          const sent = await TwilioService.sendWhatsApp(user.phone, body);
          if (sent) updates.whatsappAt = new Date();
        } else {
          // Queued for later in a real system. Here we just drop or send anyway.
          console.log(`Quiet hours: Skipping WhatsApp for ${user.phone}`);
        }
      }

      if (Object.keys(updates).length > 0) {
        await db.notification.update({
          where: { id: notification.id },
          data: updates,
        });
      }
    }
    return notification;
  }

  static async createMany(
    userIds: Array<string | null | undefined>,
    args: Omit<CreateNotificationArgs, "userId">,
  ) {
    const unique = Array.from(
      new Set(userIds.filter((id): id is string => Boolean(id))),
    );
    await Promise.all(unique.map((userId) => this.create({ ...args, userId })));
  }

  static async list(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    return db.notification.findMany({
      where: { userId, readAt: opts.unreadOnly ? null : undefined },
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 50,
    });
  }

  static async unreadCount(userId: string) {
    return db.notification.count({ where: { userId, readAt: null } });
  }

  static async markRead(userId: string, ids: string[]) {
    await db.notification.updateMany({
      where: { userId, id: { in: ids } },
      data: { readAt: new Date() },
    });
  }

  static async markAllRead(userId: string) {
    await db.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
