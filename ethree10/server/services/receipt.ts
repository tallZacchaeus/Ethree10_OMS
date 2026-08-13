import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { Prisma, type PaymentMethod, type Receipt } from "@prisma/client";
import { db } from "@/server/db/client";
import { uploadFile } from "@/lib/storage";
import { ReceiptDocument } from "@/server/documents/receipt-pdf";
import { captureCriticalFailure } from "@/lib/observability";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function generateCode() {
  return `RCPT-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
}

/** Public, shareable URL for a receipt by its code. */
export function receiptPublicUrl(code: string): string {
  return `${APP_URL}/receipt/${code}`;
}

export interface IssueManualReceiptInput {
  organizationId: string;
  invoiceId?: string | null;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentRef?: string | null;
}

export class ReceiptService {
  /**
   * Issue a receipt for a paid invoice. Idempotent: if a receipt already exists
   * for the invoice (or the same paymentRef), the existing one is returned. The
   * `invoiceId @unique` constraint makes this safe even under concurrent webhook
   * retries — a losing race is caught and the existing receipt returned.
   */
  static async issueForInvoice(
    invoiceId: string,
    opts: { paymentMethod: PaymentMethod; paymentRef?: string | null },
  ): Promise<Receipt> {
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

    const existing = await db.receipt.findUnique({ where: { invoiceId } });
    if (existing) return existing;

    // NOTE: there used to be a second idempotency check here that looked up any
    // receipt with the same `paymentRef`, unscoped by invoice. Payment
    // references are not globally unique — banks reuse them, and staff retype
    // them — so a second invoice paid with a reference already seen returned the
    // FIRST invoice's receipt and created no row of its own. The invoice was
    // left `paid` with no receipt, and the caller was handed a receipt belonging
    // to a different invoice, and potentially a different client.
    //
    // `invoiceId` is unique on Receipt, so the check above already makes this
    // idempotent for the case that check was meant to cover — a retried webhook
    // for the same invoice — and the P2002 handler below covers the concurrent
    // race. Deduplicating across invoices was never safe.

    let receipt: Receipt;
    try {
      receipt = await db.receipt.create({
        data: {
          code: generateCode(),
          invoiceId,
          organizationId: invoice.organizationId,
          amount: invoice.amount,
          currency: invoice.currency,
          paymentMethod: opts.paymentMethod,
          paymentRef: opts.paymentRef ?? invoice.paymentRef ?? null,
        },
      });
    } catch (err) {
      // Concurrent issue lost the race on the unique invoiceId — return the winner.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await db.receipt.findUnique({ where: { invoiceId } });
        if (winner) return winner;
      }
      throw err;
    }

    // The receipt must belong to the invoice we were asked about. This can only
    // trip if a future change reintroduces a lookup that is not scoped by
    // invoice; it is here because when that happened it failed silently, leaving
    // a paid invoice with no receipt and handing the caller someone else's.
    if (receipt.invoiceId !== invoiceId) {
      throw new Error(
        `Receipt ${receipt.code} belongs to invoice ${receipt.invoiceId}, not ${invoiceId}`,
      );
    }

    // Best-effort. The receipt ROW is the financial record of account; the PDF is
    // a rendering of it. A storage outage must not roll back a confirmed payment
    // or leave an invoice paid with no receipt — the PDF can be regenerated.
    await ReceiptService.generateReceiptPdf(receipt.id).catch((error) =>
      captureCriticalFailure("receipt-issuance", error, { receiptCode: receipt.code }),
    );
    return (await db.receipt.findUnique({ where: { id: receipt.id } })) ?? receipt;
  }

  /** Issue a standalone/manual receipt (e.g. for an offline bank transfer or cash). */
  static async issueManual(input: IssueManualReceiptInput): Promise<Receipt> {
    if (input.invoiceId) {
      return ReceiptService.issueForInvoice(input.invoiceId, {
        paymentMethod: input.paymentMethod,
        paymentRef: input.paymentRef ?? null,
      });
    }

    const receipt = await db.receipt.create({
      data: {
        code: generateCode(),
        organizationId: input.organizationId,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency,
        paymentMethod: input.paymentMethod,
        paymentRef: input.paymentRef ?? null,
      },
    });
    // Best-effort. The receipt ROW is the financial record of account; the PDF is
    // a rendering of it. A storage outage must not roll back a confirmed payment
    // or leave an invoice paid with no receipt — the PDF can be regenerated.
    await ReceiptService.generateReceiptPdf(receipt.id).catch((error) =>
      captureCriticalFailure("receipt-issuance", error, { receiptCode: receipt.code }),
    );
    return (await db.receipt.findUnique({ where: { id: receipt.id } })) ?? receipt;
  }

  /** Render the branded receipt PDF, upload it, persist its URL, and return the URL. */
  static async generateReceiptPdf(receiptId: string): Promise<string> {
    const receipt = await db.receipt.findUnique({
      where: { id: receiptId },
      include: { organization: true, invoice: true },
    });
    if (!receipt) throw new Error(`Receipt ${receiptId} not found`);

    const publicUrl = receiptPublicUrl(receipt.code);
    const qrDataUrl = await QRCode.toDataURL(publicUrl, { margin: 1, width: 240 });

    const buffer = await renderToBuffer(
      ReceiptDocument({
        code: receipt.code,
        currency: receipt.currency,
        amount: Number(receipt.amount),
        paidBy: receipt.organization.name,
        paymentMethod: receipt.paymentMethod,
        paymentRef: receipt.paymentRef,
        issuedAt: receipt.issuedAt,
        invoiceCode: receipt.invoice?.code ?? null,
        qrDataUrl,
        publicUrl,
      }),
    );

    const url = await uploadFile(`receipts/${receipt.code}.pdf`, buffer, "application/pdf");
    await db.receipt.update({ where: { id: receipt.id }, data: { pdfUrl: url } });
    return url;
  }
}
