import { type NextRequest, NextResponse } from "next/server";
import { PaystackService } from "@/server/services/paystack";
import { db } from "@/server/db/client";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    if (!signature || !PaystackService.verifyWebhookSignature(signature, rawBody)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    if (event.event === "charge.success") {
      const data = event.data;
      const invoiceCode = data.reference;

      // Update invoice status
      await db.invoice.update({
        where: { code: invoiceCode },
        data: {
          status: "paid",
          paidAt: new Date(data.paid_at || new Date()),
          paymentRef: String(data.id),
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Paystack Webhook Error:", error);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
