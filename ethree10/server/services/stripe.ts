import Stripe from "stripe";

// NOTE: Stripe is INACTIVE for v1.0 — the platform is Paystack-only (see
// IMPLEMENTATION-PLAN.md Stage 2). This module is kept so the webhook route and
// types still compile, but every method guards against running without a real
// key so it can never silently process payments on a mock key.
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mock";

/** Throws unless real Stripe credentials are configured (Stripe is off for v1.0). */
function assertStripeEnabled() {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe is disabled for v1.0 (Paystack only). Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET to enable it.");
  }
}

export const stripe = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2024-04-10" as any,
  appInfo: {
    name: "Ethree10 OMS",
  },
});

export class StripeService {
  static async createCheckoutSession(params: {
    invoiceId: string;
    customerEmail: string;
    amount: number; // in cents
    currency: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    assertStripeEnabled();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: params.currency.toLowerCase(),
            product_data: {
              name: `Invoice ${params.invoiceId}`,
            },
            unit_amount: params.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      customer_email: params.customerEmail,
      metadata: {
        invoiceId: params.invoiceId,
      },
    });

    return session;
  }

  static verifyWebhookSignature(payload: string | Buffer, signature: string) {
    assertStripeEnabled();
    return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  }
}
