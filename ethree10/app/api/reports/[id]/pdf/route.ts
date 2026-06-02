import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { generatePdfStream } from "@/server/reports/pdf";

// Avoid edge runtime since @react-pdf/renderer needs Node primitives
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  try {
    const report = await db.report.findUnique({
      where: { id: params.id },
    });

    if (!report) {
      return new NextResponse("Report not found", { status: 404 });
    }

    // In a real app we might fetch the scopeName from the user or subunit table
    // For MVP, we pass generic names
    let scopeName = "Unknown";
    if (report.level === "member") {
      const user = await db.user.findUnique({ where: { id: report.scopeId } });
      scopeName = user?.name || "Member";
    } else if (report.level === "subunit") {
      const subunit = await db.subUnit.findUnique({ where: { id: report.scopeId } });
      scopeName = subunit?.name || "Sub-unit";
    }

    const stream = await generatePdfStream({
      type: report.level as "member" | "subunit",
      scopeName,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      metrics: report.metrics,
    });

    return new NextResponse(stream as unknown as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="report-${report.id}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
