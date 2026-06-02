import { NextResponse, type NextRequest } from "next/server";
import { IntegrationService } from "@/server/integrations/core/service";

export const runtime = "nodejs";

/**
 * Plane webhook receiver. Verifies the HMAC signature against each Plane
 * integration's stored secret, then applies inbound events. Always responds
 * 200 quickly so Plane does not retry-storm; failures are logged server-side.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-plane-signature") ?? req.headers.get("x-hub-signature-256") ?? "";

  try {
    const result = await IntegrationService.handleInboundWebhook({
      provider: "plane",
      rawBody,
      signature,
    });
    return NextResponse.json({ ok: true, processed: result.processed });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
