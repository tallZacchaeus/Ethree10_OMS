import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_mock";

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
    return stripe.webhooks.constructEvent(payload, signature, STRIPE_WEBHOOK_SECRET);
  }
}
