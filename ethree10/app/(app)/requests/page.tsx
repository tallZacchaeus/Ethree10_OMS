"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RequestStage } from "@prisma/client";
import { useOrganization } from "@/components/providers/workspace-provider";

export default function RequestsPage() {
  const { roles, isSuperAdmin } = useOrganization();
  const [stageFilter, setStageFilter] = useState<RequestStage | "ALL">("ALL");
  
  const isAgencyStaff =
    isSuperAdmin ||
    roles.some((r: string) =>
      ["agency_admin", "finance_admin", "team_head", "member"].includes(r),
    );

  
  const { data: requests, isLoading } = trpc.requests.list.useQuery({
    stage: stageFilter !== "ALL" ? stageFilter : undefined,
  });

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "low": return <Badge variant="outline">Low</Badge>;
      case "medium": return <Badge variant="secondary">Medium</Badge>;
      case "high": return <Badge variant="default" className="bg-orange-500">High</Badge>;
      case "critical": return <Badge variant="destructive">Critical</Badge>;
      default: return <Badge variant="outline">{urgency}</Badge>;
    }
  };

  const getStageBadge = (stage: string) => {
    switch (stage) {
      case "submitted": return <Badge variant="outline">Submitted</Badge>;
      case "approved": return <Badge variant="default" className="bg-green-600">Approved</Badge>;
      case "in_progress": return <Badge variant="default" className="bg-blue-600">In Progress</Badge>;
      case "delivered": return <Badge variant="default" className="bg-purple-600">Delivered</Badge>;
      case "rejected": return <Badge variant="destructive">Rejected</Badge>;
      default: return <Badge variant="secondary">{stage.replace("_", " ")}</Badge>;
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{isAgencyStaff ? "Requests" : "Your Requests"}</h1>
          <p className="text-muted-foreground">
            {isAgencyStaff ? "Manage and track project requests." : "Track the status of your project requests."}
          </p>
        </div>
        <Link href="/requests/new">
          <Button>New Request</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center gap-4">
            <div className="w-[200px]">
              <Select value={stageFilter} onValueChange={(v) => setStageFilter(v as RequestStage | "ALL")}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Statuses</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="scoping">Scoping</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading requests...</div>
          ) : requests?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No requests found matching your filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  {isAgencyStaff && <TableHead>Team</TableHead>}
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests?.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">{req.code}</TableCell>
                    <TableCell>{req.title}</TableCell>
                    {isAgencyStaff && <TableCell>{req.routedTeamId ? "Assigned" : "Unassigned"}</TableCell>}
                    <TableCell>{getUrgencyBadge(req.urgency)}</TableCell>
                    <TableCell>{getStageBadge(req.stage)}</TableCell>
                    <TableCell>{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Link href={`/requests/${req.id}`}>
                        <Button variant="ghost" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
