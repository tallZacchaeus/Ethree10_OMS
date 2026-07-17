import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { NotificationService } from "@/server/services/notification";

/**
 * Public, token-gated request tracking (see 19-Link-Based-Client-Tracking.md).
 * The publicToken is the only credential — treat it like a bearer secret:
 * rate-limit lookups and return ONLY the client-safe projection below. Never
 * expose internal comments, audit entries, budget internals, or staff emails.
 */

// Lightweight in-process rate limiter (per key, sliding window). Good enough for
// dev/single-instance; swap for the Redis-backed limiter when we scale out.
const WINDOW_MS = 60_000;
const MAX_READS_PER_WINDOW = 60;
const MAX_COMMENTS_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimit(key: string, max: number) {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (arr.length >= max) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many requests — try again shortly." });
  }
  arr.push(now);
  hits.set(key, arr);
}

async function findByToken(token: string) {
  const request = await db.request.findUnique({
    where: { publicToken: token },
    include: {
      routedTeam: { select: { name: true, leadId: true } },
      project: { select: { status: true, targetDeliveryDate: true } },
      stageEvents: {
        orderBy: { createdAt: "asc" },
        select: { id: true, fromStage: true, toStage: true, note: true, createdAt: true },
      },
      comments: {
        where: { isInternal: false },
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true } } },
      },
    },
  });
  if (!request) {
    throw new TRPCError({ code: "NOT_FOUND", message: "This tracking link is invalid or has expired." });
  }
  return request;
}

async function agencyLeadUserIds(): Promise<string[]> {
  const leads = await db.membership.findMany({
    where: {
      role: { in: ["agency_admin", "super_admin", "finance_admin"] },
      removedAt: null,
      acceptedAt: { not: null },
    },
    select: { userId: true },
  });
  return leads.map((m) => m.userId);
}

export const trackRouter = router({
  get: publicProcedure
    .input(z.object({ token: z.string().min(16) }))
    .query(async ({ input }) => {
      rateLimit(`get:${input.token}`, MAX_READS_PER_WINDOW);
      const r = await findByToken(input.token);

      // Client-safe projection only — add fields deliberately, never spread.
      return {
        code: r.code,
        title: r.title,
        description: r.description,
        projectType: r.projectType,
        urgency: r.urgency,
        stage: r.stage,
        createdAt: r.createdAt,
        deadline: r.deadline,
        teamName: r.routedTeam?.name ?? null,
        projectStatus: r.project?.status ?? null,
        targetDeliveryDate: r.project?.targetDeliveryDate ?? null,
        requesterName: r.requesterName,
        requesterEmail: r.requesterEmail,
        timeline: r.stageEvents.map((e) => ({
          id: e.id,
          fromStage: e.fromStage,
          toStage: e.toStage,
          note: ["needs_clarification", "rejected", "delivered"].includes(e.toStage) ? e.note : null,
          createdAt: e.createdAt,
        })),
        comments: r.comments.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          // Staff replies show the staff name; client comments show the stored client name.
          authorName: c.author?.name ?? c.authorName ?? r.requesterName ?? "Client",
          fromTeam: c.authorId != null,
        })),
      };
    }),

  addComment: publicProcedure
    .input(
      z.object({
        token: z.string().min(16),
        body: z.string().min(1).max(4000),
        authorName: z.string().min(1).max(120).optional(),
        authorEmail: z.string().email().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      rateLimit(`comment:${input.token}`, MAX_COMMENTS_PER_WINDOW);
      const request = await findByToken(input.token);

      const comment = await db.taskComment.create({
        data: {
          requestId: request.id,
          authorId: null,
          authorName: input.authorName ?? request.requesterName ?? "Client",
          authorEmail: input.authorEmail ?? request.requesterEmail,
          body: input.body,
          isInternal: false,
        },
      });

      // Route the ping: team head if routed, otherwise agency admins.
      const recipientIds = request.routedTeam?.leadId
        ? [request.routedTeam.leadId]
        : await agencyLeadUserIds();
      if (recipientIds.length > 0) {
        await NotificationService.createMany(recipientIds, {
          kind: "mention",
          title: `Client comment on ${request.code}`,
          body: input.body.slice(0, 140),
          link: `/requests/${request.id}`,
          entityType: "Request",
          entityId: request.id,
        });
      }

      return { id: comment.id, createdAt: comment.createdAt };
    }),
});
