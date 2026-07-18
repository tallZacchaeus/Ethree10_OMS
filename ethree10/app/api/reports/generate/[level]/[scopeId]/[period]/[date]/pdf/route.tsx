import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { renderToStream } from "@react-pdf/renderer";
import { ReportPDF } from "@/components/reports/report-pdf";
import { type ReportLevel, type ReportPeriod } from "@prisma/client";

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ level: string; scopeId: string; period: string; date: string }>;
  }
) {
  try {
    const { level, scopeId, period, date } = await params;
    const report = await db.report.findFirst({
      where: {
        level: level as ReportLevel,
        period: period as ReportPeriod,
        scopeId,
        periodStart: new Date(date),
      },
    });

    if (!report) {
      return new NextResponse("Report not found", { status: 404 });
    }

    const scorecard = await db.kpiSnapshot.findFirst({
      where: {
        level: level as ReportLevel,
        period: period as ReportPeriod,
        scopeId,
        periodStart: new Date(date),
      },
    });

    const stream = await renderToStream(<ReportPDF report={report} scorecard={scorecard ?? undefined} />);
    
    // Convert NodeJS Readable to Web ReadableStream
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
    });

    return new NextResponse(webStream as ReadableStream, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Report_${level}_${date}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
