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
    params: { level: string; scopeId: string; period: string; date: string };
  }
) {
  try {
    const report = await db.report.findFirst({
      where: {
        level: params.level as ReportLevel,
        period: params.period as ReportPeriod,
        scopeId: params.scopeId,
        periodStart: new Date(params.date),
      },
    });

    if (!report) {
      return new NextResponse("Report not found", { status: 404 });
    }

    const scorecard = await db.kpiSnapshot.findFirst({
      where: {
        level: params.level as ReportLevel,
        period: params.period as ReportPeriod,
        scopeId: params.scopeId,
        periodStart: new Date(params.date),
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
        "Content-Disposition": `inline; filename="Report_${params.level}_${params.date}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
