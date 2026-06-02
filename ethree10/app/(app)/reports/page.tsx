"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { FileText, Play } from "lucide-react";
import { useWorkspace } from "@/components/providers/workspace-provider";

export default function ReportsPage() {
  const { activeWorkspace: currentWorkspace } = useWorkspace();
  const { data: reports, isLoading, refetch } = trpc.reports.list.useQuery();

  const generateWeekly = trpc.reports.generateWeekly.useMutation({
    onSuccess: () => {
      alert("Weekly reports generation triggered.");
      refetch();
    },
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Weekly and monthly rollups across the agency.
          </p>
        </div>
        <div className="flex space-x-2">
          {currentWorkspace?.type === "agency" && (
            <Button onClick={() => generateWeekly.mutate()} disabled={generateWeekly.isPending}>
              <Play className="mr-2 h-4 w-4" />
              Force Generate Weekly
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div>Loading reports...</div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Level</th>
                <th className="px-4 py-3 font-medium">Period</th>
                <th className="px-4 py-3 font-medium">Date Range</th>
                <th className="px-4 py-3 font-medium">Generated At</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports?.map((report) => (
                <tr key={report.id} className="border-t hover:bg-muted/50">
                  <td className="px-4 py-3 capitalize">{report.level}</td>
                  <td className="px-4 py-3 capitalize">{report.period}</td>
                  <td className="px-4 py-3">
                    {format(new Date(report.periodStart), "MMM d, yyyy")} - {format(new Date(report.periodEnd), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    {format(new Date(report.createdAt), "MMM d, yyyy HH:mm")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {report.pdfUrl && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={report.pdfUrl} target="_blank" rel="noreferrer">
                          <FileText className="mr-2 h-4 w-4" />
                          View PDF
                        </a>
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              {reports?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No reports found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
