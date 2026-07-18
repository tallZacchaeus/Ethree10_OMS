import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Urgency } from "@prisma/client";
import { router, publicProcedure } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { getAgencyAuthContext, requireAgencyAction } from "@/server/services/agency";

const serviceInput = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().optional(),
  teamId: z.string().nullable(),
  requiredBriefFields: z.array(z.string().trim().min(1)).default([]),
  expectedDeliverables: z.array(z.string().trim().min(1)).default([]),
  defaultUrgency: z.nativeEnum(Urgency).default("medium"),
  defaultSlaHours: z.number().int().positive().nullable().optional(),
  requiredReviews: z.array(z.string().trim().min(1)).default([]),
  isActive: z.boolean().default(true),
});

async function assertCanManageService(userId: string, teamId: string | null) {
  await requireAgencyAction(userId, "service.manage");
  const auth = await getAgencyAuthContext(userId);
  if (auth.isSuperAdmin || auth.roles.includes("agency_admin")) return;
  if (!teamId) throw new TRPCError({ code: "FORBIDDEN", message: "Only agency admins can manage fallback services." });
  const membership = await db.membership.findFirst({
    where: { userId, role: "team_head", teamId, removedAt: null, acceptedAt: { not: null } },
    select: { id: true },
  });
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "You can manage only your team's services." });
}

export const servicesRouter = router({
  publicList: publicProcedure.query(() =>
    db.service.findMany({
      where: { isActive: true },
      include: { team: { select: { id: true, name: true, slug: true } } },
      orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
    }),
  ),

  list: protectedProcedure.query(async ({ ctx }) => {
    await requireAgencyAction(ctx.userId, "service.read");
    return db.service.findMany({
      include: { team: { select: { id: true, name: true, slug: true } }, _count: { select: { requests: true } } },
      orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
    });
  }),

  create: protectedProcedure.input(serviceInput).mutation(async ({ ctx, input }) => {
    await assertCanManageService(ctx.userId, input.teamId);
    return db.service.create({ data: input });
  }),

  update: protectedProcedure
    .input(serviceInput.partial().extend({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const current = await db.service.findUnique({ where: { id: input.id } });
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });
      await assertCanManageService(ctx.userId, current.teamId);
      if (input.teamId !== undefined && input.teamId !== current.teamId) {
        await assertCanManageService(ctx.userId, input.teamId);
      }
      const { id, ...data } = input;
      return db.service.update({ where: { id }, data });
    }),
});
