import { NextResponse } from "next/server";
import { db } from "@/server/db/client";
import { generatePdfStream } from "@/server/reports/pdf";
import { auth } from "@/server/auth";
import { getAgencyAuthContext } from "@/server/services/agency";

// Avoid edge runtime since @react-pdf/renderer needs Node primitives
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.id) return new NextResponse("Unauthorized", { status: 401 });
    const report = await db.report.findUnique({
      where: { id },
    });

    if (!report) {
      return new NextResponse("Report not found", { status: 404 });
    }
    const agencyContext = await getAgencyAuthContext(session.user.id);
    const agencyWide = agencyContext.isSuperAdmin || agencyContext.roles.includes("agency_admin") || agencyContext.roles.includes("finance_admin");
    if (!agencyWide) {
      const canReadOwn = report.level === "member" && report.scopeId === session.user.id;
      const canReadTeam = report.level === "team" && Boolean(await db.membership.findFirst({ where: { userId: session.user.id, role: "team_head", teamId: report.scopeId, removedAt: null, acceptedAt: { not: null } } }));
      if (!canReadOwn && !canReadTeam) return new NextResponse("Forbidden", { status: 403 });
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
    } else if (report.level === "team") {
      scopeName = (await db.team.findUnique({ where: { id: report.scopeId } }))?.name ?? "Team";
    } else if (report.level === "organization") {
      scopeName = (await db.organization.findUnique({ where: { id: report.scopeId } }))?.name ?? "Organization";
    } else if (report.level === "agency") {
      scopeName = "Ethree10 Agency";
    }

    const stream = await generatePdfStream({
      type: report.level,
      period: report.period,
      scopeName,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      metrics: report.metrics as Record<string, unknown>,
      narrative: report.narrative && typeof report.narrative === "object" && !Array.isArray(report.narrative) ? report.narrative as Record<string, unknown> : undefined,
      version: report.version,
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
