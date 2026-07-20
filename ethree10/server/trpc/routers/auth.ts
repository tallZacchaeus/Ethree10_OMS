import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { protectedProcedure } from "../procedures";

function mfaDisabledError(): never {
  throw new TRPCError({
    code: "BAD_REQUEST",
    message: "Two-factor authentication has been removed from this app.",
  });
}

export const authRouter = router({
  /**
   * Returns the current session user's profile.
   * Used by the client to hydrate the auth context.
   */
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        phone: true,
        phoneVerifiedAt: true,
        timezone: true,
        workingHoursPerWeek: true,
        isSuperAdmin: true,
        memberships: {
          where: { removedAt: null, acceptedAt: { not: null } },
          select: {
            id: true,
            role: true,

            teamId: true,
            subUnitId: true,
            isPrimary: true,
          },
        },
      },
    });
    if (!user) {
      throw new TRPCError({ code: "NOT_FOUND", message: "User not found." });
    }



    return user;
  }),

  updateProfile: protectedProcedure
    .input(z.object({ name: z.string().optional(), timezone: z.string().optional(), workingHoursPerWeek: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      return ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          name: input.name,
          timezone: input.timezone,
          workingHoursPerWeek: input.workingHoursPerWeek,
        },
      });
    }),

  generateMfaSecret: protectedProcedure.mutation(() => {
    return mfaDisabledError();
  }),

  verifyAndEnableMfa: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(() => {
      return mfaDisabledError();
    }),

  disableMfa: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(() => {
      return mfaDisabledError();
    }),

  verifyMfaSession: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(() => {
      return mfaDisabledError();
    }),

  /**
   * Verifies the invitation token and returns organization context.
   * The actual acceptance is handled by the POST (mutation).
   */
  getInvitation: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input, ctx }) => {
      const membership = await ctx.db.membership.findFirst({
        where: {
          id: input.token,
          invitedAt: { not: null },
          acceptedAt: null,
          removedAt: null,
        },
        select: {
          id: true,
          role: true,
        },
      });
      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found or already used.",
        });
      }
      return membership;
    }),
});
