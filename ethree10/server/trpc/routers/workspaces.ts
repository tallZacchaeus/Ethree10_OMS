import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { WorkspaceType, Role } from "@prisma/client";
import { router } from "../trpc";
import { protectedProcedure, workspaceProcedure, superAdminProcedure } from "../procedures";

const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const workspacesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const memberships = await ctx.db.membership.findMany({
      where: { userId: ctx.userId, removedAt: null, acceptedAt: { not: null } },
      select: {
        id: true,
        role: true,
        isPrimary: true,
        workspace: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            logoUrl: true,
            archivedAt: true,
          },
        },
      },
    });
    return memberships.map((m) => ({
      membershipId: m.id,
      role: m.role,
      isPrimary: m.isPrimary,
      workspace: m.workspace,
    }));
  }),

  get: workspaceProcedure.query(async ({ ctx }) => {
    const ws = await ctx.db.workspace.findUnique({
      where: { id: ctx.workspaceId },
    });
    if (!ws) throw new TRPCError({ code: "NOT_FOUND" });
    return ws;
  }),

  create: superAdminProcedure
    .input(
      z.object({
        name: z.string().min(2),
        type: z.nativeEnum(WorkspaceType),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const slug = slugify(input.name);
      return ctx.db.workspace.create({
        data: {
          name: input.name,
          slug,
          type: input.type,
          description: input.description,
        },
      });
    }),

  update: workspaceProcedure
    .input(
      z.object({
        name: z.string().min(2).optional(),
        description: z.string().optional(),
        brandColor: z.string().optional(),
        logoUrl: z.string().url().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("workspace.update");
      return ctx.db.workspace.update({
        where: { id: ctx.workspaceId },
        data: input,
      });
    }),

  archive: workspaceProcedure.mutation(async ({ ctx }) => {
    await ctx.authorize("workspace.archive");
    return ctx.db.workspace.update({
      where: { id: ctx.workspaceId },
      data: { archivedAt: new Date() },
    });
  }),

  inviteUser: workspaceProcedure
    .input(
      z.object({
        email: z.string().email(),
        name: z.string().min(1),
        role: z.nativeEnum(Role),
        departmentId: z.string().optional(),
        subUnitId: z.string().optional(),
        title: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("workspace.invite");
      const user = await ctx.db.user.upsert({
        where: { email: input.email },
        create: { email: input.email, name: input.name },
        update: {},
      });
      return ctx.db.membership.create({
        data: {
          userId: user.id,
          workspaceId: ctx.workspaceId,
          role: input.role,
          departmentId: input.departmentId,
          subUnitId: input.subUnitId,
          title: input.title,
          invitedAt: new Date(),
        },
      });
    }),

  removeMember: workspaceProcedure
    .input(z.object({ membershipId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("workspace.removeMember");
      return ctx.db.membership.update({
        where: { id: input.membershipId },
        data: { removedAt: new Date() },
      });
    }),

  changeRole: workspaceProcedure
    .input(z.object({ membershipId: z.string(), role: z.nativeEnum(Role) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.authorize("workspace.changeRole");
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
