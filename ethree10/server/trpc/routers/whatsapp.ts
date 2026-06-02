import { z } from "zod";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { db } from "@/server/db/client";
import { TwilioService } from "@/server/notifications/twilio";
import { TRPCError } from "@trpc/server";

export const whatsappRouter = router({
  sendVerification: protectedProcedure
    .input(z.object({ phone: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Generate a 6-digit code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      await db.user.update({
        where: { id: ctx.userId },
        data: {
          phone: input.phone,
          phoneVerificationCode: code,
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
      const user = await db.user.findUnique({
        where: { id: ctx.userId },
        select: { phoneVerificationCode: true },
      });

      if (!user?.phoneVerificationCode || user.phoneVerificationCode !== input.code) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid verification code.",
        });
      }

      await db.user.update({
        where: { id: ctx.userId },
        data: {
          phoneVerifiedAt: new Date(),
          phoneVerificationCode: null,
        },
      });

      return { ok: true };
    }),
});
