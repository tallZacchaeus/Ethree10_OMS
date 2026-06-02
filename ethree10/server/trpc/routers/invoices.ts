import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { InvoiceStatus } from "@prisma/client";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { publicProcedure } from "../trpc";
import { db } from "@/server/db/client";
import { getAgencyAuthContext, requireAgencyAction } from "@/server/services/agency";
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
        include: { workspace: true, project: true },
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
      return invoice;
    }),

  markVoid: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "workspace.read");
      const invoice = await db.invoice.update({
        where: { id: input.id },
        data: { status: "void" },
      });
      return invoice;
    }),
});
