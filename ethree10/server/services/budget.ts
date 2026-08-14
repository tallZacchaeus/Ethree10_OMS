import { Prisma, type Budget, type BudgetStatus, type PaymentMethod } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { ReceiptService } from "@/server/services/receipt";
import { requireAgencyAction } from "@/server/services/agency";
import { NotificationService } from "@/server/services/notification";
import { NotificationAudience } from "@/server/services/notification-audience";
import { DelegationService } from "@/server/services/delegation";
import { captureCriticalFailure } from "@/lib/observability";

/**
 * Money governance.
 *
 * Two rules hold everywhere in this file, and they are the whole point of it:
 *
 *   1. **Approval gate.** No money moves — no invoice is issued to a client and
 *      no expense is paid — until the Chief Executive has approved that
 *      project's budget.
 *   2. **Separation of duties.** The person who approves a budget may never be
 *      the person who confirms money moved against it. Enforced per-transaction
 *      here, and per-user at the membership level via `assertSeparationOfDuties`.
 *
 * Both are enforced server-side. UI gating is a convenience, never the control.
 */

/** Raised when an action is blocked by a governance rule (not by RBAC). */
function governanceError(message: string): TRPCError {
  return new TRPCError({ code: "FORBIDDEN", message });
}

export interface SubmitBudgetInput {
  projectId: string;
  amount: number;
  clientAmount?: number | null;
  internalAmount?: number | null;
  currency?: string;
  notes?: string | null;
}

export class BudgetService {
  /** The budget for a project, with its full decision history. */
  static async getForProject(projectId: string) {
    return db.budget.findUnique({
      where: { projectId },
      include: {
        decisions: { orderBy: { createdAt: "desc" }, include: { actor: { select: { id: true, name: true } } } },
        submittedBy: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
        expenses: true,
      },
    });
  }

  /** Everything awaiting a Chief Executive decision. */
  static async listPendingApproval() {
    return db.budget.findMany({
      where: { status: "submitted" },
      include: {
        project: { include: { organization: { select: { name: true } }, team: { select: { name: true } } } },
        submittedBy: { select: { id: true, name: true } },
      },
      orderBy: { submittedAt: "asc" },
    });
  }

  static async list(status?: BudgetStatus) {
    return db.budget.findMany({
      where: status ? { status } : undefined,
      include: {
        project: { include: { organization: { select: { name: true } }, team: { select: { name: true } } } },
        submittedBy: { select: { id: true, name: true } },
        decidedBy: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  /**
   * Create or revise a project budget and send it for approval.
   *
   * Re-submitting an already-approved budget resets it to `submitted` and bumps
   * the version — a lead cannot quietly raise an approved ceiling, because the
   * approval is cleared and has to be granted again.
   */
  static async submit(actorId: string, input: SubmitBudgetInput): Promise<Budget> {
    await requireAgencyAction(actorId, "budget.submit");

    const project = await db.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found." });

    if (input.amount <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Budget amount must be greater than zero." });
    }

    const existing = await db.budget.findUnique({ where: { projectId: input.projectId } });

    const data = {
      currency: input.currency ?? "NGN",
      amount: new Prisma.Decimal(input.amount),
      clientAmount: input.clientAmount != null ? new Prisma.Decimal(input.clientAmount) : null,
      internalAmount: input.internalAmount != null ? new Prisma.Decimal(input.internalAmount) : null,
      notes: input.notes ?? null,
      status: "submitted" as BudgetStatus,
      submittedById: actorId,
      submittedAt: new Date(),
      // A revision clears the previous decision. Approval never carries over.
      decidedById: null,
      decidedAt: null,
      decisionNote: null,
    };

    const budget = existing
      ? await db.budget.update({
          where: { id: existing.id },
          data: { ...data, version: existing.version + 1 },
        })
      : await db.budget.create({ data: { ...data, projectId: input.projectId } });

    await db.budgetDecision.create({
      data: {
        budgetId: budget.id,
        action: "submitted",
        actorId,
        amountAtDecision: budget.amount,
        note: input.notes ?? null,
      },
    });

    await AuditService.log({
      actorId,
      action: existing ? "budget.resubmitted" : "budget.submitted",
      entityType: "Budget",
      entityId: budget.id,
      after: { amount: input.amount, version: budget.version, projectId: input.projectId },
    });

    // Tell every Chief Executive there is something to approve — and anyone
    // currently holding a delegation, or a submission during an absence sits
    // unseen, which is the whole thing delegation exists to prevent.
    const approverMemberships = await db.membership.findMany({
      where: { role: "chief_executive", removedAt: null, acceptedAt: { not: null } },
      select: { userId: true },
    });
    const activeDelegations = await DelegationService.listActive();
    const approverIds = new Set([
      ...approverMemberships.map((m) => m.userId),
      ...activeDelegations.map((d) => d.delegateId),
    ]);
    const approvers = Array.from(approverIds, (userId) => ({ userId }));
    for (const approver of approvers) {
      await NotificationService.create({
        userId: approver.userId,
        kind: "approval_requested",
        title: "Budget awaiting your approval",
        body: `${project.name} — ${budget.currency} ${input.amount.toLocaleString()}`,
        link: `/budgets`,
      });
    }

    return budget;
  }

  /**
   * Approve or reject a submitted budget. Only `chief_executive` holds
   * `budget.approve`, so this is the single point where spending is authorised.
   */
  static async decide(
    actorId: string,
    args: { budgetId: string; decision: "approved" | "rejected"; note?: string | null },
  ): Promise<Budget> {
    await requireAgencyAction(actorId, "budget.approve");

    const budget = await db.budget.findUnique({
      where: { id: args.budgetId },
      include: { project: true },
    });
    if (!budget) throw new TRPCError({ code: "NOT_FOUND", message: "Budget not found." });

    if (budget.status !== "submitted") {
      throw governanceError(
        `This budget is "${budget.status}", not awaiting a decision. Ask the branch to resubmit it.`,
      );
    }

    // A submitter cannot approve their own submission, even if they somehow hold
    // both permissions. Belt and braces alongside the role-level exclusion.
    if (budget.submittedById && budget.submittedById === actorId) {
      throw governanceError("You submitted this budget, so you cannot also approve it.");
    }

    const updated = await db.budget.update({
      where: { id: budget.id },
      data: {
        status: args.decision,
        decidedById: actorId,
        decidedAt: new Date(),
        decisionNote: args.note ?? null,
      },
    });

    // An auditor reading BudgetDecision should see that an approval was made
    // under delegation without having to cross-reference another table.
    const delegation = await DelegationService.activeFor(actorId);
    const noteWithProvenance = delegation
      ? [args.note?.trim(), `[Approved under delegation granted ${delegation.startsAt.toDateString()}, expiring ${delegation.expiresAt.toDateString()}]`]
          .filter(Boolean)
          .join(" ")
      : args.note ?? null;

    await db.budgetDecision.create({
      data: {
        budgetId: budget.id,
        action: args.decision,
        actorId,
        amountAtDecision: budget.amount,
        note: noteWithProvenance,
      },
    });

    await AuditService.log({
      actorId,
      action: `budget.${args.decision}`,
      entityType: "Budget",
      entityId: budget.id,
      before: { status: budget.status },
      after: { status: args.decision, note: args.note ?? null },
    });

    // The submitter needs to know, but so does everyone waiting on the money:
    // an approval unblocks invoicing and spend for the whole project team.
    await NotificationService.createMany(
      await NotificationAudience.projectTeam(budget.projectId, actorId),
      {
        kind: "budget_decided",
        title: `Budget ${args.decision} — ${budget.project.name}`,
        body: `${budget.currency} ${budget.amount.toString()}${args.note ? ` · ${args.note}` : ""}`,
        link: `/projects/${budget.projectId}`,
        entityType: "Budget",
        entityId: budget.id,
        allowDuplicate: true,
      },
    );

    if (budget.submittedById && budget.submittedById !== actorId) {
      await NotificationService.create({
        userId: budget.submittedById,
        kind: "budget_decided",
        title: `Budget ${args.decision}`,
        body: `${budget.project.name} — ${budget.currency} ${budget.amount.toString()}${
          args.note ? ` · ${args.note}` : ""
        }`,
        link: `/projects/${budget.projectId}`,
      });
    }

    return updated;
  }

  /**
   * The spending gate. Throws unless the project has an approved budget.
   * Called before an invoice is issued and before any expense is paid.
   */
  static async assertApproved(projectId: string | null | undefined): Promise<Budget> {
    if (!projectId) {
      throw governanceError(
        "This invoice is not attached to a project, so there is no approved budget behind it. " +
          "Attach it to a project first.",
      );
    }
    const budget = await db.budget.findUnique({ where: { projectId } });
    if (!budget) {
      throw governanceError("No budget has been submitted for this project yet.");
    }
    if (budget.status !== "approved") {
      throw governanceError(
        `The budget for this project is "${budget.status}". The Chief Executive must approve it before any money moves.`,
      );
    }
    return budget;
  }

  /**
   * Finance confirms that client funds landed, which issues the receipt.
   *
   * This is the second half of separation of duties: the confirmer may not be
   * the person who approved the budget being paid against.
   */
  static async confirmInvoicePayment(
    actorId: string,
    args: { invoiceId: string; paymentMethod: PaymentMethod; paymentRef?: string | null },
  ) {
    await requireAgencyAction(actorId, "payment.confirm");

    const invoice = await db.invoice.findUnique({ where: { id: args.invoiceId } });
    if (!invoice) throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });

    if (invoice.status === "void") {
      throw governanceError("This invoice is void.");
    }
    if (invoice.paymentConfirmedAt) {
      throw governanceError("This payment has already been confirmed.");
    }

    const budget = await BudgetService.assertApproved(invoice.projectId);

    if (budget.decidedById && budget.decidedById === actorId) {
      throw governanceError(
        "You approved this project's budget, so you cannot also confirm its payment. " +
          "Separation of duties requires a second person.",
      );
    }

    const updated = await db.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        paymentRef: args.paymentRef ?? invoice.paymentRef,
        paymentConfirmedById: actorId,
        paymentConfirmedAt: new Date(),
      },
    });

    // Receipt is issued only after confirmation — internal record and audit proof.
    // If this throws, the invoice is already marked paid, so the mismatch has to
    // be visible rather than swallowed.
    let receipt;
    try {
      receipt = await ReceiptService.issueForInvoice(invoice.id, {
        paymentMethod: args.paymentMethod,
        paymentRef: args.paymentRef ?? invoice.paymentRef,
      });
    } catch (error) {
      captureCriticalFailure("payment-confirmation", error, {
        invoiceId: invoice.id,
        invoiceCode: invoice.code,
        note: "Invoice marked paid but receipt issuance failed",
      });
      throw error;
    }

    // Money landing is the event the whole agency waits on, so it goes to
    // Finance and the executives rather than only the person who clicked.
    const moneyAudience = await NotificationAudience.moneyOversight(actorId);
    await NotificationService.createMany(moneyAudience, {
      kind: "payment_received",
      title: `Payment received — ${invoice.code}`,
      body: `${invoice.currency} ${invoice.amount.toString()} confirmed${
        args.paymentRef ? ` · ref ${args.paymentRef}` : ""
      }`,
      link: `/invoices`,
      entityType: "Invoice",
      entityId: invoice.id,
      allowDuplicate: true,
    });
    await NotificationService.createMany(moneyAudience, {
      kind: "receipt_issued",
      title: `Receipt ${receipt.code} issued`,
      body: `For invoice ${invoice.code}.`,
      link: `/receipts`,
      entityType: "Receipt",
      entityId: receipt.id,
      allowDuplicate: true,
    });

    await AuditService.log({
      actorId,
      action: "invoice.paymentConfirmed",
      entityType: "Invoice",
      entityId: invoice.id,
      before: { status: invoice.status },
      after: { status: "paid", receiptId: receipt.id, paymentRef: args.paymentRef ?? null },
    });

    return { invoice: updated, receipt };
  }

  // ── Outbound spend ───────────────────────────────────────────────────────

  /** Request spend against an approved budget. */
  static async requestExpense(
    actorId: string,
    args: { projectId: string; description: string; amount: number; note?: string | null },
  ) {
    await requireAgencyAction(actorId, "expense.request");
    const budget = await BudgetService.assertApproved(args.projectId);

    if (args.amount <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Expense amount must be greater than zero." });
    }

    // Keep total committed spend inside the approved envelope.
    const ceiling = budget.internalAmount ?? budget.amount;
    const committed = await db.expense.aggregate({
      where: { budgetId: budget.id, status: { in: ["requested", "approved", "paid"] } },
      _sum: { amount: true },
    });
    const alreadyCommitted = committed._sum.amount ?? new Prisma.Decimal(0);
    const wouldTotal = alreadyCommitted.add(new Prisma.Decimal(args.amount));
    if (wouldTotal.greaterThan(ceiling)) {
      throw governanceError(
        `This would take committed spend to ${budget.currency} ${wouldTotal.toString()}, ` +
          `over the approved ${budget.currency} ${ceiling.toString()}. ` +
          `Ask the Chief Executive to approve a revised budget first.`,
      );
    }

    const expense = await db.expense.create({
      data: {
        projectId: args.projectId,
        budgetId: budget.id,
        description: args.description,
        amount: new Prisma.Decimal(args.amount),
        currency: budget.currency,
        requestedById: actorId,
        note: args.note ?? null,
      },
    });

    await AuditService.log({
      actorId,
      action: "expense.requested",
      entityType: "Expense",
      entityId: expense.id,
      after: { amount: args.amount, projectId: args.projectId },
    });

    // Finance are the only people who can pay this, so they are the only people
    // for whom it is actionable. Without this the request sat until somebody
    // happened to open the Expenses screen.
    await NotificationService.createMany(await NotificationAudience.finance(actorId), {
      kind: "expense_requested",
      title: "Expense awaiting payment",
      body: `${args.description} — ${budget.currency} ${args.amount.toLocaleString()}`,
      link: "/expenses",
      entityType: "Expense",
      entityId: expense.id,
      allowDuplicate: true,
    });

    return expense;
  }

  /** Finance pays an approved expense. The requester may never pay their own. */
  static async payExpense(
    actorId: string,
    args: { expenseId: string; paymentRef?: string | null; proofUrl?: string | null },
  ) {
    await requireAgencyAction(actorId, "expense.pay");

    const expense = await db.expense.findUnique({ where: { id: args.expenseId }, include: { budget: true } });
    if (!expense) throw new TRPCError({ code: "NOT_FOUND", message: "Expense not found." });
    if (expense.status === "paid") throw governanceError("This expense has already been paid.");
    if (expense.status === "rejected") throw governanceError("This expense was rejected.");

    await BudgetService.assertApproved(expense.projectId);

    if (expense.requestedById === actorId) {
      throw governanceError("You requested this expense, so you cannot also pay it.");
    }
    if (expense.budget.decidedById && expense.budget.decidedById === actorId) {
      throw governanceError(
        "You approved this project's budget, so you cannot also pay against it.",
      );
    }

    const paid = await db.expense.update({
      where: { id: expense.id },
      data: {
        status: "paid",
        paidById: actorId,
        paidAt: new Date(),
        paymentRef: args.paymentRef ?? null,
        proofUrl: args.proofUrl ?? null,
      },
    });

    await AuditService.log({
      actorId,
      action: "expense.paid",
      entityType: "Expense",
      entityId: expense.id,
      before: { status: expense.status },
      after: { status: "paid", paymentRef: args.paymentRef ?? null },
    });

    await NotificationService.create({
      userId: expense.requestedById,
      kind: "expense_paid",
      title: "Expense paid",
      body: `${expense.description} — ${expense.currency} ${expense.amount.toString()}`,
      link: `/expenses`,
    });

    return paid;
  }

  static async listExpenses(filter?: { projectId?: string; status?: "requested" | "approved" | "paid" | "rejected" }) {
    return db.expense.findMany({
      where: {
        projectId: filter?.projectId,
        status: filter?.status,
      },
      include: {
        project: { select: { id: true, name: true, code: true } },
        requestedBy: { select: { id: true, name: true } },
        paidBy: { select: { id: true, name: true } },
        budget: { select: { status: true, amount: true, currency: true, decidedById: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
