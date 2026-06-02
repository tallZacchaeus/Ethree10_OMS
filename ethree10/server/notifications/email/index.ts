import { render } from "@react-email/components";
import { Resend } from "resend";
import { env } from "@/lib/env";
import { NotificationEmail } from "@/server/notifications/email/templates/notification-email";

let client: Resend | null = null;
function resend(): Resend {
  if (!client) client = new Resend(env.RESEND_API_KEY);
  return client;
}

export interface SendNotificationEmailArgs {
  to: string;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaPath?: string;
}

/**
 * Renders and sends a transactional notification email. Best-effort: callers
 * should not block on this and failures are logged, not thrown.
 */
export class EmailService {
  static async sendNotification(args: SendNotificationEmailArgs): Promise<boolean> {
    try {
      const html = await render(
        NotificationEmail({
          title: args.title,
          body: args.body,
          ctaLabel: args.ctaLabel,
          ctaPath: args.ctaPath,
        }),
      );
      const { error } = await resend().emails.send({
        from: env.EMAIL_FROM,
        to: args.to,
        subject: `[Ethree10] ${args.title}`,
        html,
      });
      if (error) {
        console.error("Email send failed", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Email render/send error", err);
      return false;
    }
  }
}
