import { TRPCError } from "@trpc/server";
import { publicProcedure, middleware } from "./trpc";
import { AuthorizationService } from "@/server/services/authorization";

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

// Resolves the caller's CLIENT organization from their membership and scopes the db to it.
// For client-facing operations (submit/track their org's work). Staff have no org and are
// rejected here — they use protectedProcedure + agency authorization instead.
const enforceOrg = middleware(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const resolved = await AuthorizationService.resolve(ctx.userId);
  if (!resolved.organizationId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "No client organization for this account.",
    });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      organizationId: resolved.organizationId,
      scope: ctx.scopedDb(resolved.organizationId),
    },
  });
});

export const protectedProcedure = publicProcedure.use(enforceAuth);
export const superAdminProcedure = publicProcedure.use(enforceSuperAdmin);
export const orgProcedure = publicProcedure.use(enforceAuth).use(enforceOrg);
