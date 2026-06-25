import crypto from "crypto";

/**
 * Resolve the Paystack secret key at call time. In production a real key is
 * mandatory — we throw rather than silently fall back to a mock key (which would
 * make every live payment/webhook fail in confusing ways). In dev/test a clearly
 * fake placeholder keeps local boot working without real credentials.
 */
function getPaystackSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (key) return key;
  if (process.env.NODE_ENV === "production") {
    throw new Error("PAYSTACK_SECRET_KEY is required in production");
  }
  return "sk_test_mock";
}

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
        Authorization: `Bearer ${getPaystackSecretKey()}`,
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
    const hash = crypto.createHmac("sha512", getPaystackSecretKey()).update(payload).digest("hex");
    return hash === signature;
  }
}
