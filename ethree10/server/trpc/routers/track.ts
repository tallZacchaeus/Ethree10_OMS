import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { NotificationService } from "@/server/services/notification";
import { ClientTrackingService } from "@/server/services/client-tracking";
import { enforcePublicRateLimit } from "@/server/security/public-rate-limit";

async function agencyLeadUserIds() {
  const leads = await db.membership.findMany({
    where: {
      role: { in: ["agency_admin", "super_admin"] },
      removedAt: null,
      acceptedAt: { not: null },
    },
    select: { userId: true },
  });
  return leads.map((membership) => membership.userId);
}

/**
 * Everyone who should hear about a client message on a request.
 *
 * Previously this was "the routed branch head, or else agency admins". That
 * missed the person most likely to act on it — the project manager running the
 * work — and went silent altogether when the routed branch had no lead
 * assigned. Agency admins are always included as a backstop so a client
 * message can never land with nobody watching.
 */
async function clientMessageRecipients(requestId: string): Promise<string[]> {
  const request = await db.request.findUnique({
    where: { id: requestId },
    select: {
      routedTeam: { select: { leadId: true } },
      project: { select: { pmUserId: true } },
    },
  });

  const recipients = [
    request?.routedTeam?.leadId,
    request?.project?.pmUserId,
    ...(await agencyLeadUserIds()),
  ].filter((id): id is string => Boolean(id));

  return Array.from(new Set(recipients));
}

const tokenInput = z.string().min(32).max(128);

export const trackRouter = router({
  get: publicProcedure
    .input(z.object({ token: tokenInput }))
    .query(async ({ input }) => {
      await enforcePublicRateLimit({ action: "track-read", secret: input.token, limit: 60 });
      return ClientTrackingService.project(await ClientTrackingService.findRequest(input.token));
    }),

  addComment: publicProcedure
    .input(z.object({ token: tokenInput, body: z.string().trim().min(2).max(4000) }))
    .mutation(async ({ input }) => {
      await enforcePublicRateLimit({ action: "track-comment", secret: input.token, limit: 5 });
      const request = await ClientTrackingService.findRequest(input.token);
      const comment = await db.taskComment.create({
        data: {
          requestId: request.id,
          authorId: null,
          authorName: request.requesterName ?? "Client",
          authorEmail: request.requesterEmail,
          body: input.body,
          isInternal: false,
        },
      });
      const recipients = await clientMessageRecipients(request.id);
      if (recipients.length) {
        await NotificationService.createMany(recipients, {
          kind: "mention",
          title: `Client replied on ${request.code}`,
          body: input.body.slice(0, 140),
          link: `/requests/${request.id}`,
          entityType: "Request",
          entityId: request.id,
          // Every client reply is new content. Without this, a second message
          // inside the dedup window is swallowed and nobody is told.
          allowDuplicate: true,
        });
      }
      return { id: comment.id, createdAt: comment.createdAt };
    }),

  decideDelivery: publicProcedure
    .input(z.object({
      token: tokenInput,
      decision: z.enum(["accepted", "changes_requested"]),
      message: z.string().trim().max(4000).optional(),
    }))
    .mutation(async ({ input }) => {
      await enforcePublicRateLimit({ action: "track-decision", secret: input.token, limit: 3, windowSeconds: 300 });
      return ClientTrackingService.decide(input);
    }),
});
