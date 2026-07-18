import { NextResponse } from "next/server";
import { getHealth, type HealthMode } from "@/server/ops/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const mode = new URL(request.url).searchParams.get("mode") === "ready" ? "ready" : "live";
  const health = await getHealth(mode as HealthMode);
  return NextResponse.json(health, { status: health.status === "ok" ? 200 : 503 });
}
