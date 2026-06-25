import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { InvoiceStatus, PaymentMethod } from "@prisma/client";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { publicProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { getAgencyAuthContext, requireAgencyAction } from "@/server/services/agency";
import { InvoiceService, invoicePublicUrl } from "@/server/services/invoice";
import { ReceiptService } from "@/server/services/receipt";
import { EmailService } from "@/server/notifications/email";
import { AuditService } from "@/server/services/audit";
function generateCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

export const invoicesRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.nativeEnum(InvoiceStatus).optional() }).optional())
    .query(async ({ ctx, input }) => {
      // In a real system we'd limit this to the agency admin or the specific client workspace.
      // For now, if you are an agency admin, you see all.
      const authCtx = await getAgencyAuthContext(ctx.userId);
      if (!authCtx.isSuperAdmin && !authCtx.roles.includes("agency_admin") && !authCtx.roles.includes("agency_lead")) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      return db.invoice.findMany({
        where: input?.status ? { status: input.status } : undefined,
        include: { workspace: true, project: true },
        orderBy: { createdAt: "desc" },
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await db.invoice.findUnique({
        where: { id: input.id },
        include: { workspace: true, project: true, receipt: true },
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      return invoice;
    }),

  getByCode: publicProcedure
    .input(z.object({ code: z.string() }))
    .query(async ({ input }) => {
      const invoice = await db.invoice.findUnique({
        where: { code: input.code },
        include: { workspace: true, project: true },
      });
      if (!invoice) throw new TRPCError({ code: "NOT_FOUND" });
      return invoice;
    }),

  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string(),
        projectId: z.string().optional(),
        currency: z.enum(["NGN", "USD"]),
        dueAt: z.string().optional(),
        lineItems: z.array(
          z.object({
            description: z.string().min(1),
            quantity: z.number().min(1),
            unitPrice: z.number().min(0),
          })
        ).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "workspace.read");

      const totalAmount = input.lineItems.reduce(
        (acc, item) => acc + item.quantity * item.unitPrice,
        0
      );

      const invoice = await db.invoice.create({
        data: {
          code: `INV-${generateCode()}`,
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          currency: input.currency,
          amount: totalAmount,
          lineItems: input.lineItems,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          status: "draft",
        },
      });

      return invoice;
    }),

  markSent: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "workspace.read");
      const invoice = await db.invoice.update({
        where: { id: input.id },
        data: { status: "sent", issuedAt: new Date() },
      });
      // Generate the branded PDF so the public viewer and email have a document.
      await InvoiceService.generateInvoicePdf(invoice.id).catch((err) =>
        console.error("Invoice PDF generation failed", invoice.code, err),
      );
      return invoice;
    }),

  // Regenerate (or first-time generate) the branded invoice PDF; returns its URL.
  regeneratePdf: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "workspace.read");
      const url = await InvoiceService.generateInvoicePdf(input.id);
      return { pdfUrl: url };
    }),

  // Email the client a link to the public invoice. Marks the invoice sent.
  send: protectedProcedure
    .input(z.object({ id: z.string(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "workspace.read");
      const invoice = await db.invoice.update({
        where: { id: input.id },
        data: { status: "sent", issuedAt: new Date() },
      });
      await InvoiceService.generateInvoicePdf(invoice.id).catch((err) =>
        console.error("Invoice PDF generation failed", invoice.code, err),
      );
      const sent = await EmailService.sendNotification({
        to: input.email,
        title: `Invoice ${invoice.code}`,
        body: `An invoice is ready for you to view and pay online.`,
        ctaLabel: "View & Pay Invoice",
        ctaPath: `/invoice/${invoice.code}`,
      });
      await AuditService.log({
        actorId: ctx.userId,
        workspaceId: invoice.workspaceId,
        action: "invoice.send",
        entityType: "Invoice",
        entityId: invoice.id,
        after: { to: input.email, emailed: sent },
      });
      return { emailed: sent, publicUrl: invoicePublicUrl(invoice.code) };
    }),

  // Manually mark an invoice paid (offline bank transfer / cash) and issue a receipt.
  markPaid: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        paymentMethod: z.nativeEnum(PaymentMethod).default("bank_transfer"),
        paymentRef: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "workspace.read");
      const invoice = await db.invoice.update({
        where: { id: input.id },
        data: { status: "paid", paidAt: new Date(), paymentRef: input.paymentRef ?? null },
      });
      const receipt = await ReceiptService.issueForInvoice(invoice.id, {
        paymentMethod: input.paymentMethod,
        paymentRef: input.paymentRef ?? null,
      });
      await AuditService.log({
        actorId: ctx.userId,
        workspaceId: invoice.workspaceId,
        action: "invoice.markPaid",
        entityType: "Invoice",
        entityId: invoice.id,
        after: { paymentMethod: input.paymentMethod, receiptCode: receipt.code },
      });
      return { invoice, receiptCode: receipt.code };
    }),

  markVoid: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "workspace.read");
      const invoice = await db.invoice.update({
        where: { id: input.id },
        data: { status: "void" },
      });
      await AuditService.log({
        actorId: ctx.userId,
        workspaceId: invoice.workspaceId,
        action: "invoice.void",
        entityType: "Invoice",
        entityId: invoice.id,
      });
      return invoice;
    }),
});
