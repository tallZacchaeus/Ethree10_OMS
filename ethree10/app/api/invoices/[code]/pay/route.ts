import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { PaystackService } from "@/server/services/paystack";
import { invoicePublicUrl } from "@/server/services/invoice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Initialise a Paystack transaction for an invoice and redirect the payer to
 * Paystack's hosted checkout. The `email` query param is the payer's email
 * (collected on the public invoice page). On completion Paystack redirects back
 * to the invoice page; the webhook does the authoritative status update.
 */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const email = req.nextUrl.searchParams.get("email");
  const publicUrl = invoicePublicUrl(params.code);

  if (!email) {
    return NextResponse.redirect(`${publicUrl}?error=email-required`);
  }

  const invoice = await db.invoice.findUnique({ where: { code: params.code } });
  if (!invoice) {
    return new NextResponse("Invoice not found", { status: 404 });
  }
  if (invoice.status === "paid") {
    return NextResponse.redirect(publicUrl);
  }
  if (invoice.currency !== "NGN") {
    return NextResponse.redirect(`${publicUrl}?error=currency-unsupported`);
  }

  try {
    const { authorization_url } = await PaystackService.initializePayment({
      email,
      amount: Math.round(Number(invoice.amount) * 100), // NGN → kobo
      reference: invoice.code,
      callback_url: publicUrl,
    });
    return NextResponse.redirect(authorization_url);
  } catch (err) {
    console.error("Paystack init failed for", params.code, err);
    return NextResponse.redirect(`${publicUrl}?error=payment-init-failed`);
  }
}
