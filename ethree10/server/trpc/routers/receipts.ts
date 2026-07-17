import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { PaymentMethod } from "@prisma/client";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { publicProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { getAgencyAuthContext, requireAgencyAction } from "@/server/services/agency";
import { ReceiptService } from "@/server/services/receipt";
import { AuditService } from "@/server/services/audit";

async function requireAgencyView(userId: string) {
  const authCtx = await getAgencyAuthContext(userId);
  if (!authCtx.isSuperAdmin && !authCtx.roles.includes("agency_admin") && !authCtx.roles.includes("finance_admin")) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

export const receiptsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await requireAgencyView(ctx.userId);
    return db.receipt.findMany({
      include: { organization: true, invoice: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAgencyView(ctx.userId);
      const receipt = await db.receipt.findUnique({
        where: { id: input.id },
        include: { organization: true, invoice: true },
      });
      if (!receipt) throw new TRPCError({ code: "NOT_FOUND" });
      return receipt;
    }),

  // Public verification by code (the code is the capability token).
  getByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const receipt = await db.receipt.findUnique({
        where: { code: input.code },
        include: { organization: true, invoice: true },
      });
      if (!receipt) throw new TRPCError({ code: "NOT_FOUND" });
      return receipt;
    }),

  // Issue a manual receipt (offline bank transfer / cash), optionally tied to an invoice.
  issueManual: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        invoiceId: z.string().optional(),
        amount: z.number().min(0),
        currency: z.enum(["NGN", "USD"]).default("NGN"),
        paymentMethod: z.nativeEnum(PaymentMethod).default("bank_transfer"),
        paymentRef: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "receipt.issue");
      const receipt = await ReceiptService.issueManual({
        organizationId: input.organizationId,
        invoiceId: input.invoiceId ?? null,
        amount: input.amount,
        currency: input.currency,
        paymentMethod: input.paymentMethod,
        paymentRef: input.paymentRef ?? null,
      });
      await AuditService.log({
        actorId: ctx.userId,
        organizationId: input.organizationId,
        action: "receipt.issue",
        entityType: "Receipt",
        entityId: receipt.id,
        after: { code: receipt.code, method: input.paymentMethod, invoiceId: input.invoiceId ?? null },
      });
      return receipt;
    }),

  // Regenerate (or first-time generate) the branded receipt PDF; returns its URL.
  regeneratePdf: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "receipt.issue");
      const url = await ReceiptService.generateReceiptPdf(input.id);
      return { pdfUrl: url };
    }),
});
