import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { formatPdfMoney } from "@/server/documents/brand-layout";
import { InvoiceDocument, sumLineItems } from "@/server/documents/invoice-pdf";
import { ReceiptDocument } from "@/server/documents/receipt-pdf";

describe("formatPdfMoney", () => {
  it("formats NGN with code prefix and thousands separators", () => {
    expect(formatPdfMoney(500000, "NGN")).toBe("NGN 500,000.00");
  });

  it("formats USD", () => {
    expect(formatPdfMoney(1234.5, "USD")).toBe("USD 1,234.50");
  });

  it("defaults to NGN and handles non-finite input", () => {
    expect(formatPdfMoney(0)).toBe("NGN 0.00");
    expect(formatPdfMoney(Number.NaN, "USD")).toBe("USD 0.00");
  });
});

describe("sumLineItems", () => {
  it("sums quantity × unit price across items", () => {
    expect(
      sumLineItems([
        { description: "Design", quantity: 2, unitPrice: 50000 },
        { description: "Dev", quantity: 1, unitPrice: 150000 },
      ]),
    ).toBe(250000);
  });

  it("returns 0 for no items", () => {
    expect(sumLineItems([])).toBe(0);
  });
});

describe("branded PDF rendering", () => {
  it("renders a non-empty invoice PDF buffer", async () => {
    const buffer = await renderToBuffer(
      InvoiceDocument({
        code: "INV-TEST1234",
        currency: "NGN",
        status: "sent",
        billedTo: "Micah 415",
        issuedAt: new Date("2026-06-01T00:00:00Z"),
        dueAt: new Date("2026-06-15T00:00:00Z"),
        lineItems: [{ description: "Landing page", quantity: 1, unitPrice: 500000 }],
      }),
    );
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("renders a non-empty receipt PDF buffer", async () => {
    const buffer = await renderToBuffer(
      ReceiptDocument({
        code: "RCPT-TEST1234",
        currency: "NGN",
        amount: 500000,
        paidBy: "Micah 415",
        paymentMethod: "paystack",
        paymentRef: "PSK-123",
        issuedAt: new Date("2026-06-10T00:00:00Z"),
        invoiceCode: "INV-TEST1234",
      }),
    );
    expect(buffer.length).toBeGreaterThan(0);
  });
});
