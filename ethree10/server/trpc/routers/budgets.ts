import { z } from "zod";
import { BudgetStatus, PaymentMethod } from "@prisma/client";
import { router } from "../trpc";
import { protectedProcedure } from "../procedures";
import { BudgetService } from "@/server/services/budget";
import { requireAgencyAction } from "@/server/services/agency";

/**
 * Budget approval and spend. Every mutation delegates its authorisation and its
 * governance rules to `BudgetService` — the router only shapes input.
 */
export const budgetsRouter = router({
  list: protectedProcedure
    .input(z.object({ status: z.nativeEnum(BudgetStatus).optional() }).optional())
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "budget.read");
      return BudgetService.list(input?.status);
    }),

  pendingApproval: protectedProcedure.query(async ({ ctx }) => {
    await requireAgencyAction(ctx.userId, "budget.read");
    return BudgetService.listPendingApproval();
  }),

  forProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "budget.read");
      return BudgetService.getForProject(input.projectId);
    }),

  submit: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        amount: z.number().positive(),
        clientAmount: z.number().nonnegative().nullish(),
        internalAmount: z.number().nonnegative().nullish(),
        currency: z.string().default("NGN"),
        notes: z.string().max(2000).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => BudgetService.submit(ctx.userId, input)),

  decide: protectedProcedure
    .input(
      z.object({
        budgetId: z.string(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().max(2000).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => BudgetService.decide(ctx.userId, input)),

  confirmInvoicePayment: protectedProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        paymentMethod: z.nativeEnum(PaymentMethod).default("bank_transfer"),
        paymentRef: z.string().max(200).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => BudgetService.confirmInvoicePayment(ctx.userId, input)),

  listExpenses: protectedProcedure
    .input(
      z
        .object({
          projectId: z.string().optional(),
          status: z.enum(["requested", "approved", "paid", "rejected"]).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      await requireAgencyAction(ctx.userId, "expense.read");
      return BudgetService.listExpenses(input);
    }),

  requestExpense: protectedProcedure
    .input(
      z.object({
        projectId: z.string(),
        description: z.string().min(3).max(500),
        amount: z.number().positive(),
        note: z.string().max(2000).nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => BudgetService.requestExpense(ctx.userId, input)),

  payExpense: protectedProcedure
    .input(
      z.object({
        expenseId: z.string(),
        paymentRef: z.string().max(200).nullish(),
        proofUrl: z.string().url().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => BudgetService.payExpense(ctx.userId, input)),
});
