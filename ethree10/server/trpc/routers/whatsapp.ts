import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { TwilioService } from "@/server/notifications/twilio";
import { TRPCError } from "@trpc/server";
import { secureNumericCode } from "@/server/security/secure-code";
import { enforcePublicRateLimit } from "@/server/security/public-rate-limit";

/**
 * How long a code stays good for. Long enough to switch to WhatsApp, read it
 * and switch back; short enough that the window for guessing is measured in
 * minutes rather than in however long it is until someone next verifies a phone.
 */
const CODE_TTL_MS = 10 * 60 * 1000;

/**
 * Guesses allowed per user per hour. Six digits is 1,000,000 possibilities, so
 * ten tries an hour puts a brute force past eleven years — while leaving room
 * for a person who mistypes.
 */
const VERIFY_ATTEMPTS_PER_HOUR = 10;

/** Codes sent per user per hour, so the send path is not an SMS bill either. */
const SEND_ATTEMPTS_PER_HOUR = 5;

export const whatsappRouter = router({
  sendVerification: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await enforcePublicRateLimit({
        action: "whatsapp.send",
        secret: ctx.userId,
        limit: SEND_ATTEMPTS_PER_HOUR,
        windowSeconds: 3600,
      });

      // From the OS CSPRNG, not Math.random: a predictable code is no code at
      // all. See server/security/secure-code.ts.
      const code = secureNumericCode(6);

      await db.user.update({
        where: { id: ctx.userId },
        data: {
          phone: input.phone,
          phoneVerificationCode: code,
          phoneVerificationExpiresAt: new Date(Date.now() + CODE_TTL_MS),
          phoneVerifiedAt: null, // Reset verification if number changes
        },
      });

      const sent = await TwilioService.sendOtp(input.phone, code);
      if (!sent) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to send WhatsApp verification code.",
        });
      }
      return { ok: true };
    }),

  verifyCode: protectedProcedure
    .input(z.object({ code: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Counted before the comparison, so a wrong guess costs an attempt. Doing
      // it after would let an attacker spend the budget only on the guess that
      // was going to succeed anyway.
      await enforcePublicRateLimit({
        action: "whatsapp.verify",
        secret: ctx.userId,
        limit: VERIFY_ATTEMPTS_PER_HOUR,
        windowSeconds: 3600,
      });

      const user = await db.user.findUnique({
        where: { id: ctx.userId },
        select: { phoneVerificationCode: true, phoneVerificationExpiresAt: true },
      });

      // No expiry recorded means the code predates the expiry column. Treating
      // that as valid forever is the thing this is here to stop, so it fails.
      const expired =
        !user?.phoneVerificationExpiresAt ||
        user.phoneVerificationExpiresAt.getTime() <= Date.now();

      if (!user?.phoneVerificationCode || expired || user.phoneVerificationCode !== input.code) {
        // One message for wrong, missing and expired alike: telling the caller
        // which of the three it was tells them whether they are guessing against
        // a live code.
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired verification code. Request a new one.",
        });
      }

      await db.user.update({
        where: { id: ctx.userId },
        data: {
          phoneVerifiedAt: new Date(),
          phoneVerificationCode: null,
          phoneVerificationExpiresAt: null,
        },
      });

      return { ok: true };
    }),
});
