import { NextResponse } from "next/server";
import { ReportService } from "@/server/services/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ReportService.generateWeekly({ actorId: "system" });
    return NextResponse.json({ success: true, message: "Weekly reports generated" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Cron / reports error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
