import crypto from "crypto";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || "sk_test_mock";

export class PaystackService {
  static async initializePayment(params: {
    email: string;
    amount: number; // in kobo (1 NGN = 100 kobo)
    reference: string;
    callback_url?: string;
  }) {
    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Paystack initialization failed: ${errorText}`);
    }

    const data = await response.json();
    return data.data as { authorization_url: string; access_code: string; reference: string };
  }

  static verifyWebhookSignature(signature: string, payload: string) {
    const hash = crypto.createHmac("sha512", PAYSTACK_SECRET_KEY).update(payload).digest("hex");
    return hash === signature;
  }
}
