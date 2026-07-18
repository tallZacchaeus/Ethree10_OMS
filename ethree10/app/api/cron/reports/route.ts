import { NextResponse } from "next/server";
import { ReportService } from "@/server/services/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const expected = process.env["CRON_SECRET"];
    if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
      return NextResponse.json({ success: false }, { status: 401 });
    }
    const period = new URL(request.url).searchParams.get("period") === "monthly" ? "monthly" : "weekly";
    const anchor = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = period === "monthly"
      ? await ReportService.generateMonthly({ actorId: "system", anchor })
      : await ReportService.generateWeekly({ actorId: "system", anchor });
    return NextResponse.json({ success: true, period, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Cron / reports error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
