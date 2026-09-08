import { db } from "@/server/db/client";

/**
 * Money records that disagree with each other.
 *
 * `confirmInvoicePayment` marks the invoice paid and then issues the receipt.
 * Those are deliberately not one transaction — a storage or PDF failure must
 * not roll back a confirmed payment — but that means a failure between them
 * leaves an invoice marked paid with no receipt. Today the only trace is a
 * `captureCriticalFailure` call, so it lands in the logs of a Sentry project
 * that has no DSN configured in production. Nothing notices, and nothing goes
 * looking.
 *
 * These are read-only checks. They report; a human repairs. Automatically
 * issuing a missing receipt would paper over whatever caused the gap, and the
 * gap is the interesting part.
 */

export type ReconciliationFinding = {
  kind: "paid-without-receipt" | "receipt-without-payment" | "amount-mismatch";
  invoiceCode: string;
  invoiceId: string;
  detail: string;
};

export const ReconciliationService = {
  /** Paid invoices carrying no receipt. The failure mode described above. */
  async paidWithoutReceipt(): Promise<ReconciliationFinding[]> {
    const invoices = await db.invoice.findMany({
      where: { paymentConfirmedAt: { not: null }, receipt: { is: null } },
      select: { id: true, code: true, paymentConfirmedAt: true, amount: true, currency: true },
    });

    return invoices.map((invoice) => ({
      kind: "paid-without-receipt" as const,
      invoiceCode: invoice.code,
      invoiceId: invoice.id,
      detail: `Confirmed ${invoice.paymentConfirmedAt?.toISOString() ?? "?"} for ${invoice.currency} ${invoice.amount.toString()}, no receipt issued.`,
    }));
  },

  /**
   * Receipts against invoices that are not marked paid — the mirror image,
   * which would mean a receipt was issued outside `confirmInvoicePayment`.
   */
  async receiptWithoutPayment(): Promise<ReconciliationFinding[]> {
    const receipts = await db.receipt.findMany({
      where: { invoiceId: { not: null }, invoice: { is: { paymentConfirmedAt: null } } },
      select: { code: true, invoiceId: true, invoice: { select: { code: true } } },
    });

    return receipts.map((receipt) => ({
      kind: "receipt-without-payment" as const,
      invoiceCode: receipt.invoice?.code ?? "(unknown)",
      invoiceId: receipt.invoiceId ?? "",
      detail: `Receipt ${receipt.code} exists but the invoice is not marked paid.`,
    }));
  },

  /** A receipt whose amount or currency does not match the invoice it settles. */
  async amountMismatch(): Promise<ReconciliationFinding[]> {
    const receipts = await db.receipt.findMany({
      where: { invoiceId: { not: null } },
      select: {
        code: true,
        amount: true,
        currency: true,
        invoiceId: true,
        invoice: { select: { code: true, amount: true, currency: true } },
      },
    });

    return receipts
      .filter(
        (receipt) =>
          receipt.invoice &&
          (!receipt.amount.equals(receipt.invoice.amount) ||
            receipt.currency !== receipt.invoice.currency),
      )
      .map((receipt) => ({
        kind: "amount-mismatch" as const,
        invoiceCode: receipt.invoice?.code ?? "(unknown)",
        invoiceId: receipt.invoiceId ?? "",
        detail: `Receipt ${receipt.code} is ${receipt.currency} ${receipt.amount.toString()}; invoice is ${receipt.invoice?.currency} ${receipt.invoice?.amount.toString()}.`,
      }));
  },

  async all(): Promise<ReconciliationFinding[]> {
    const [paid, orphaned, mismatched] = await Promise.all([
      ReconciliationService.paidWithoutReceipt(),
      ReconciliationService.receiptWithoutPayment(),
      ReconciliationService.amountMismatch(),
    ]);
    return [...paid, ...orphaned, ...mismatched];
  },
};
