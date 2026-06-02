"use client";

import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-ext/page-header";

export default function ReportViewerPage({ params }: { params: { id: string } }) {
  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild className="shrink-0">
          <Link href="/reports">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to list
          </Link>
        </Button>
      </div>

      <PageHeader
        title="Report Viewer"
        description="View or download this weekly report."
        actions={
          <Button asChild>
            <a href={`/api/reports/${params.id}/pdf`} download={`report-${params.id}.pdf`}>
              <Download className="mr-2 h-4 w-4" /> Download PDF
            </a>
          </Button>
        }
      />

      <div className="flex-1 rounded-lg border bg-muted/20 p-2 md:p-4">
        <iframe
          src={`/api/reports/${params.id}/pdf`}
          className="h-[800px] w-full rounded border bg-white shadow-sm"
          title="PDF Report Viewer"
        />
      </div>
    </div>
  );
}
