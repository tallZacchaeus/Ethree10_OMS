import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * E2E scenario 3: the money path — public invoice + receipt pages.
 *
 * Seeds a paid invoice and its issued receipt straight into the DB (no PDF /
 * storage needed — the public pages render from DB fields) and asserts both
 * shareable pages render, and that an unknown code 404s rather than 500s.
 *
 * The full live flow (Paystack checkout → webhook → auto-issue) is verified
 * against a real Paystack test account during staging, and the idempotent
 * auto-issue is covered deterministically by tests/integration/receipt-idempotency.
 */
const BASE = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";
const db = new PrismaClient();

const stamp = Date.now();
const INVOICE_CODE = `INV-E2E-${stamp}`;
const RECEIPT_CODE = `RCPT-E2E-${stamp}`;
let workspaceId: string;
let invoiceId: string;

test.beforeAll(async () => {
  const ws = await db.workspace.create({
    data: { type: "agency", name: "E2E Money WS", slug: `e2e-money-${stamp}`, defaultCurrency: "NGN" },
  });
  workspaceId = ws.id;
  const invoice = await db.invoice.create({
    data: {
      code: INVOICE_CODE,
      workspaceId: ws.id,
      status: "paid",
      currency: "NGN",
      amount: "250000.00",
      lineItems: [{ description: "Website build", quantity: 1, unitPrice: 250000 }],
      issuedAt: new Date(),
      paidAt: new Date(),
      paymentRef: "PSTK_E2E_REF",
    },
  });
  invoiceId = invoice.id;
  await db.receipt.create({
    data: {
      code: RECEIPT_CODE,
      invoiceId: invoice.id,
      workspaceId: ws.id,
      amount: "250000.00",
      currency: "NGN",
      paymentMethod: "paystack",
      paymentRef: "PSTK_E2E_REF",
    },
  });
});

test.afterAll(async () => {
  await db.receipt.deleteMany({ where: { invoiceId } });
  await db.invoice.delete({ where: { id: invoiceId } }).catch(() => {});
  await db.workspace.delete({ where: { id: workspaceId } }).catch(() => {});
  await db.$disconnect();
});

test.describe("Money path — public invoice & receipt", () => {
  test("public invoice page renders a paid invoice", async ({ page }) => {
    await page.goto(`${BASE}/invoice/${INVOICE_CODE}`);
    await expect(page.getByText(`Invoice ${INVOICE_CODE}`)).toBeVisible();
    await expect(page.getByText("PAID", { exact: true })).toBeVisible();
    await expect(page.getByText(/Website build/)).toBeVisible();
  });

  test("public receipt page renders the issued receipt", async ({ page }) => {
    await page.goto(`${BASE}/receipt/${RECEIPT_CODE}`);
    await expect(page.getByText(`Receipt ${RECEIPT_CODE}`)).toBeVisible();
    await expect(page.getByText("PAID", { exact: true })).toBeVisible();
    await expect(page.getByText(/Paystack/)).toBeVisible();
  });

  test("unknown invoice code returns 404, not a server error", async ({ page }) => {
    const res = await page.goto(`${BASE}/invoice/INV-DOES-NOT-EXIST`);
    expect(res?.status()).toBe(404);
  });

  test("unknown receipt code returns 404, not a server error", async ({ page }) => {
    const res = await page.goto(`${BASE}/receipt/RCPT-DOES-NOT-EXIST`);
    expect(res?.status()).toBe(404);
  });
});
