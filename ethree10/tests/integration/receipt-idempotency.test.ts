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
  let workspaceId: string;
  let invoiceId: string;

  beforeAll(async () => {
    await ensureBucket();
    const ws = await db.workspace.create({
      data: { type: "agency", name: "Receipt IT WS", slug: `receipt-it-${Date.now()}`, defaultCurrency: "NGN" },
    });
    workspaceId = ws.id;
    const inv = await db.invoice.create({
      data: {
        code: `INV-IT-${Date.now()}`,
        workspaceId: ws.id,
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
    await db.receipt.deleteMany({ where: { invoiceId } });
    await db.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
    await db.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
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
