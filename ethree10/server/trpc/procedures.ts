import { TRPCError } from "@trpc/server";
import { publicProcedure, middleware } from "./trpc";

const enforceAuth = middleware(({ ctx, next }) => {
  if (!ctx.session || !ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be signed in.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      session: ctx.session,
    },
  });
});

const enforceSuperAdmin = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const user = await ctx.db.user.findUnique({
    where: { id: ctx.userId },
    select: { isSuperAdmin: true },
  });
  if (!user?.isSuperAdmin) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Super-admin access required.",
    });
  }
  return next({ ctx });
});

const enforceWorkspace = middleware(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.workspaceId) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "x-workspace-id header required.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      workspaceId: ctx.workspaceId,
      scope: ctx.scopedDb(ctx.workspaceId),
    },
  });
});

export const protectedProcedure = publicProcedure.use(enforceAuth);
export const superAdminProcedure = publicProcedure.use(enforceSuperAdmin);
export const workspaceProcedure = publicProcedure.use(enforceAuth).use(enforceWorkspace);
