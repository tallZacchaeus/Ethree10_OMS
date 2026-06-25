import { afterAll, beforeAll, describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { PaystackService } from "@/server/services/paystack";

const TEST_KEY = "sk_test_paystack_unit_key";
const sign = (payload: string) =>
  crypto.createHmac("sha512", TEST_KEY).update(payload).digest("hex");

describe("PaystackService.verifyWebhookSignature", () => {
  const prevKey = process.env.PAYSTACK_SECRET_KEY;

  beforeAll(() => {
    process.env.PAYSTACK_SECRET_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (prevKey === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = prevKey;
  });

  it("accepts a signature produced with the secret key", () => {
    const payload = JSON.stringify({ event: "charge.success", data: { reference: "INV-ABC123" } });
    expect(PaystackService.verifyWebhookSignature(sign(payload), payload)).toBe(true);
  });

  it("rejects a signature from the wrong key", () => {
    const payload = JSON.stringify({ event: "charge.success", data: { reference: "INV-ABC123" } });
    const wrong = crypto.createHmac("sha512", "sk_test_wrong_key").update(payload).digest("hex");
    expect(PaystackService.verifyWebhookSignature(wrong, payload)).toBe(false);
  });

  it("rejects when the payload is tampered after signing", () => {
    const payload = JSON.stringify({ event: "charge.success", data: { reference: "INV-ABC123" } });
    const signature = sign(payload);
    const tampered = JSON.stringify({ event: "charge.success", data: { reference: "INV-HACKED" } });
    expect(PaystackService.verifyWebhookSignature(signature, tampered)).toBe(false);
  });
});
