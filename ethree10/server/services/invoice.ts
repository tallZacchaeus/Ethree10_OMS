import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import { db } from "@/server/db/client";
import { uploadFile } from "@/lib/storage";
import { InvoiceDocument, type InvoiceLineItem } from "@/server/documents/invoice-pdf";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Public, shareable URL for an invoice by its code. */
export function invoicePublicUrl(code: string): string {
  return `${APP_URL}/invoice/${code}`;
}

function parseLineItems(value: unknown): InvoiceLineItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((li): li is Record<string, unknown> => typeof li === "object" && li !== null)
    .map((li) => ({
      description: String(li.description ?? ""),
      quantity: Number(li.quantity ?? 0),
      unitPrice: Number(li.unitPrice ?? 0),
    }));
}

export class InvoiceService {
  /**
   * Render the branded invoice PDF, upload it to object storage, persist the
   * resulting URL on the invoice, and return that URL.
   */
  static async generateInvoicePdf(invoiceId: string): Promise<string> {
    const invoice = await db.invoice.findUnique({
      where: { id: invoiceId },
      include: { organization: true },
    });
    if (!invoice) throw new Error(`Invoice ${invoiceId} not found`);

    const publicUrl = invoicePublicUrl(invoice.code);
    const qrDataUrl = await QRCode.toDataURL(publicUrl, { margin: 1, width: 240 });

    const buffer = await renderToBuffer(
      InvoiceDocument({
        code: invoice.code,
        currency: invoice.currency,
        status: invoice.status,
        billedTo: invoice.organization.name,
        issuedAt: invoice.issuedAt,
        dueAt: invoice.dueAt,
        lineItems: parseLineItems(invoice.lineItems),
        qrDataUrl,
        publicUrl,
      }),
    );

    const url = await uploadFile(`invoices/${invoice.code}.pdf`, buffer, "application/pdf");
    await db.invoice.update({ where: { id: invoice.id }, data: { pdfUrl: url } });
    return url;
  }

  /**
   * Flip any `sent` invoice whose due date has passed to `overdue`.
   * Returns the number of invoices transitioned. Intended for a daily job.
   */
  static async markOverdue(now: Date = new Date()): Promise<number> {
    const result = await db.invoice.updateMany({
      where: { status: "sent", dueAt: { not: null, lt: now } },
      data: { status: "overdue" },
    });
    return result.count;
  }
}
