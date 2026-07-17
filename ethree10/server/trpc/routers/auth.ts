import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../trpc";
import { protectedProcedure } from "../procedures";
import { cookies } from "next/headers";
import { generateSecret, generateURI, verifySync } from "otplib/functional";
import { NobleCryptoPlugin, ScureBase32Plugin } from "otplib";

const plugins = { crypto: new NobleCryptoPlugin(), base32: new ScureBase32Plugin() };

function totpGenerateSecret(): string {
  return generateSecret();
}

function totpKeyuri(email: string, issuer: string, secret: string): string {
  return generateURI({ strategy: "totp", label: email, issuer, secret });
}

function totpVerify(token: string, secret: string): boolean {
  return Boolean(verifySync({ strategy: "totp", token, secret, ...plugins }));
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

  generateMfaSecret: protectedProcedure.mutation(async ({ ctx }) => {
    const secret = totpGenerateSecret();
    const uri = totpKeyuri(ctx.session?.user?.email || "user@ethree10.app", "Ethree10 OMS", secret);
    
    // Store temporarily until verified
    await ctx.db.user.update({
      where: { id: ctx.userId },
      data: { mfaSecret: secret },
    });

    return { secret, uri };
  }),

  verifyAndEnableMfa: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { mfaSecret: true },
      });

      if (!user?.mfaSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "MFA not initiated." });
      }

      const isValid = totpVerify(input.code, user.mfaSecret);

      if (!isValid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid code." });
      }

      // Generate recovery codes
      const recoveryCodes = Array.from({ length: 8 }, () => 
        Math.random().toString(36).substring(2, 8).toUpperCase() + "-" + 
        Math.random().toString(36).substring(2, 8).toUpperCase()
      );

      await ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          mfaEnabled: true,
          mfaRecoveryCodes: recoveryCodes,
        },
      });

      return { recoveryCodes };
    }),

  disableMfa: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { mfaSecret: true, mfaEnabled: true },
      });

      if (!user?.mfaEnabled || !user?.mfaSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "MFA not enabled." });
      }

      const isValid = totpVerify(input.code, user.mfaSecret);

      if (!isValid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid code." });
      }

      await ctx.db.user.update({
        where: { id: ctx.userId },
        data: {
          mfaEnabled: false,
          mfaSecret: null,
          mfaRecoveryCodes: [],
        },
      });

      return { ok: true };
    }),

  verifyMfaSession: protectedProcedure
    .input(z.object({ code: z.string().length(6) }))
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { mfaSecret: true, mfaEnabled: true },
      });

      if (!user?.mfaEnabled || !user?.mfaSecret) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "MFA not enabled." });
      }

      const isValid = totpVerify(input.code, user.mfaSecret);

      if (!isValid) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid code." });
      }

      // Set cookie to remember MFA verified state for this session
      cookies().set("mfa-verified", "true", { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 // 1 day
      });

      return { ok: true };
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
