import { type NextRequest, NextResponse } from "next/server";
import { StripeService } from "@/server/services/stripe";
import { db } from "@/server/db/client";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 401 });
    }

    let event;
    try {
      event = StripeService.verifyWebhookSignature(rawBody, signature);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as { metadata?: { invoiceId?: string }; payment_intent?: string };
      const invoiceId = session.metadata?.invoiceId;

      if (invoiceId) {
        await db.invoice.update({
          where: { id: invoiceId },
          data: {
            status: "paid",
            paidAt: new Date(),
            paymentRef: session.payment_intent as string,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe Webhook Error:", error);
    return NextResponse.json({ error: "Webhook Error" }, { status: 500 });
  }
}
