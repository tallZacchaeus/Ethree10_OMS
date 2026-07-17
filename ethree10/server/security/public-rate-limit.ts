import { createHash } from "crypto";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db/client";

function safeKey(secret: string) {
  return createHash("sha256").update(secret).digest("hex");
}

/** Database-backed fixed-window limiter shared by every web instance. */
export async function enforcePublicRateLimit(args: {
  action: string;
  secret: string;
  limit: number;
  windowSeconds?: number;
}) {
  const windowSeconds = args.windowSeconds ?? 60;
  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const record = await db.publicRateLimit.upsert({
    where: { key_action_windowStart: { key: safeKey(args.secret), action: args.action, windowStart } },
    update: { count: { increment: 1 } },
    create: {
      key: safeKey(args.secret),
      action: args.action,
      windowStart,
      expiresAt: new Date(windowStart.getTime() + windowMs),
    },
    select: { count: true },
  });

  if (record.count > args.limit) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests. Please try again shortly." });
  }
}
