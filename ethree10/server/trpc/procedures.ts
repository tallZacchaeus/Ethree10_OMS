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

export const protectedProcedure = publicProcedure.use(enforceAuth);
export const superAdminProcedure = publicProcedure.use(enforceSuperAdmin);
