import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Role } from "@prisma/client";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * Membership + client-organization management. (Organizations were removed; the agency is
 * implicit and clients are grouped into Organizations.)
 */
export const organizationsRouter = router({
  // The caller's memberships, with their org (null = agency staff). Used by the session provider.
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.membership.findMany({
      where: { userId: ctx.userId, removedAt: null, acceptedAt: { not: null } },
      select: {
        id: true,
        role: true,
        isPrimary: true,
      },
    });
    return memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      isPrimary: m.isPrimary,
      organization: null,
    }));
  }),

  // List all client organizations (staff view).
  listOrganizations: protectedProcedure.query(async ({ ctx }) => {
    await ctx.authorize("organization.read");
    return ctx.db.organization.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
    });
  }),

  getOrganization: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await ctx.authorize("organization.read");
      const organization = await ctx.db.organization.findUnique({
        where: { id: input.id },
        include: {
          requests: { orderBy: { createdAt: "desc" }, take: 10, select: { id: true, code: true, title: true, stage: true, createdAt: true } },
          projects: { orderBy: { updatedAt: "desc" }, take: 10, select: { id: true, code: true, name: true, status: true, targetDeliveryDate: true } },
          reports: { orderBy: { periodStart: "desc" }, take: 10, select: { id: true, period: true, status: true, periodStart: true, periodEnd: true } },
          _count: { select: { requests: true, projects: true, invoices: true, receipts: true, reports: true } },
        },
      });
      if (!organization) throw new TRPCError({ code: "NOT_FOUND" });
      return organization;
    }),

  createOrganization: protectedProcedure
    .input(
      z.object({
        name: z.string().min(2),
        isExternal: z.boolean().default(false),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("organization.create");
      return ctx.db.organization.create({
        data: {
          name: input.name,
          slug: slugify(input.name),
          isExternal: input.isExternal,
          description: input.description,
        },
      });
    }),

  archiveOrganization: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("organization.archive");
      return ctx.db.organization.update({
        where: { id: input.id },
        data: { archivedAt: new Date() },
      });
    }),

  // Invite a member. organizationId set = client member of that org; null = agency staff.
  inviteUser: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1),
        role: z.nativeEnum(Role),
        teamId: z.string().optional(),
        subUnitId: z.string().optional(),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("organization.invite");
      const user = await ctx.db.user.upsert({
        where: { email: input.email },
        create: { email: input.email, name: input.name },
        update: {},
      });
      return ctx.db.membership.create({
        data: {
          userId: user.id,
          role: input.role,
          teamId: input.teamId,
          subUnitId: input.subUnitId,
          title: input.title,
          invitedAt: new Date(),
          acceptedAt: new Date(),
        },
      });
    }),

  removeMember: protectedProcedure
    .input(z.object({ membershipId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("organization.removeMember");
      return ctx.db.membership.update({
        where: { id: input.membershipId },
        data: { removedAt: new Date() },
      });
    }),

  changeRole: protectedProcedure
    .input(z.object({ membershipId: z.string(), role: z.nativeEnum(Role) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("organization.changeRole");
      return ctx.db.membership.update({
        where: { id: input.membershipId },
        data: { role: input.role },
      });
    }),

  acceptInvite: protectedProcedure
    .input(z.object({ membershipId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const m = await ctx.db.membership.findUnique({
        where: { id: input.membershipId },
      });
      if (!m || m.userId !== ctx.userId) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return ctx.db.membership.update({
        where: { id: input.membershipId },
        data: { acceptedAt: new Date() },
      });
    }),
});
