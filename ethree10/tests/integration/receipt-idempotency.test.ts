import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";
import { s3 } from "@/lib/storage";
import { env } from "@/lib/env";
import { ReceiptService } from "@/server/services/receipt";

/**
 * Money-path integration test (headline launch requirement):
 * a paid invoice auto-issues exactly ONE receipt, and re-running issuance
 * (as a Paystack webhook retry would) returns the same receipt rather than
 * minting a duplicate. Exercises the real Postgres + MinIO path.
 *
 * Requires local infra: `docker compose up -d` then `pnpm db:push`.
 */
const db = new PrismaClient();

async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: env.STORAGE_BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: env.STORAGE_BUCKET }));
  }
}

describe("ReceiptService.issueForInvoice — idempotent auto-issue", () => {
  let organizationId: string;
  let invoiceId: string;

  beforeAll(async () => {
    await ensureBucket();
    const ws = await db.organization.create({
      data: { name: "Receipt IT WS", slug: `receipt-it-${Date.now()}`, defaultCurrency: "NGN" },
    });
    organizationId = ws.id;
    const inv = await db.invoice.create({
      data: {
        code: `INV-IT-${Date.now()}`,
        organizationId: ws.id,
        status: "paid",
        currency: "NGN",
        amount: "150000.00",
        lineItems: [{ description: "Brand sprint", quantity: 1, unitPrice: 150000 }],
        paidAt: new Date(),
        paymentRef: "PSTK_REF_IT",
      },
    });
    invoiceId = inv.id;
  });

  afterAll(async () => {
    try {
      if (invoiceId) await db.receipt.deleteMany({ where: { invoiceId } });
      if (invoiceId) await db.invoice.delete({ where: { id: invoiceId } });
      if (organizationId) await db.organization.delete({ where: { id: organizationId } });
    } catch(e) {}
    await db.$disconnect();
  });

  it("issues a receipt with a code and an uploaded PDF", async () => {
    const receipt = await ReceiptService.issueForInvoice(invoiceId, {
      paymentMethod: "paystack",
      paymentRef: "PSTK_REF_IT",
    });
    expect(receipt.code).toMatch(/^RCPT-/);
    expect(receipt.pdfUrl).toBeTruthy();
    expect(Number(receipt.amount)).toBe(150000);
  });

  it("is idempotent under webhook retries — exactly one receipt per invoice", async () => {
    const again = await ReceiptService.issueForInvoice(invoiceId, {
      paymentMethod: "paystack",
      paymentRef: "PSTK_REF_IT",
    });
    expect(again.code).toMatch(/^RCPT-/);
    const count = await db.receipt.count({ where: { invoiceId } });
    expect(count).toBe(1);
  });

  it("survives a concurrent double-issue without minting duplicates", async () => {
    const [a, b] = await Promise.all([
      ReceiptService.issueForInvoice(invoiceId, { paymentMethod: "paystack", paymentRef: "PSTK_REF_IT" }),
      ReceiptService.issueForInvoice(invoiceId, { paymentMethod: "paystack", paymentRef: "PSTK_REF_IT" }),
    ]);
    expect(a.id).toBe(b.id);
    const count = await db.receipt.count({ where: { invoiceId } });
    expect(count).toBe(1);
  });
});

describe("ReceiptService.issueForInvoice — offline payment methods", () => {
  let organizationId: string;

  beforeAll(async () => {
    await ensureBucket();
    const ws = await db.organization.create({
      data: { name: "Offline Pay WS", slug: `offline-pay-${Date.now()}`, defaultCurrency: "NGN" },
    });
    organizationId = ws.id;
  });

  afterAll(async () => {
    try {
      if (organizationId) await db.receipt.deleteMany({ where: { organizationId } });
      if (organizationId) await db.invoice.deleteMany({ where: { organizationId } });
      if (organizationId) await db.organization.delete({ where: { id: organizationId } });
    } catch (e) {}
  });

  // The headline of this feature: cheque/bank-transfer/cash are first-class
  // alongside Paystack and persist their method + reference on the receipt.
  it.each(["cheque", "bank_transfer", "cash", "other"] as const)(
    "issues a %s receipt with its method and reference",
    async (paymentMethod) => {
      const invoice = await db.invoice.create({
        data: {
          code: `INV-${paymentMethod}-${Date.now()}`,
          organizationId,
          status: "paid",
          currency: "NGN",
          amount: "90000.00",
          lineItems: [{ description: "Retainer", quantity: 1, unitPrice: 90000 }],
          paidAt: new Date(),
        },
      });
      const ref = `${paymentMethod.toUpperCase()}-REF`;
      const receipt = await ReceiptService.issueForInvoice(invoice.id, { paymentMethod, paymentRef: ref });
      expect(receipt.paymentMethod).toBe(paymentMethod);
      expect(receipt.paymentRef).toBe(ref);
      expect(receipt.code).toMatch(/^RCPT-/);
    },
  );
});
