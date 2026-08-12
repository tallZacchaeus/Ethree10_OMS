"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RequestStage, Role } from "@prisma/client";
import { REQUEST_ACCESS_ROLES } from "@/server/auth/role-groups";
import { useAgencyContext } from "@/components/providers/agency-provider";

export default function RequestsPage() {
  const { roles, isSuperAdmin } = useAgencyContext();
  const [stageFilter, setStageFilter] = useState<RequestStage | "ALL">("ALL");

  // Same role set the router enforces via `request.read`. Checked here only so
  // a deep link shows an explanation instead of a failed query.
  const canReadRequests =
    isSuperAdmin || roles.some((r: Role) => REQUEST_ACCESS_ROLES.includes(r));

  const { data: requests, isLoading } = trpc.requests.list.useQuery(
    { stage: stageFilter !== "ALL" ? stageFilter : undefined },
    { enabled: canReadRequests },
  );

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

  if (!canReadRequests) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <h1 className="text-lg font-semibold">Requests are limited to leads</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Client requests are handled by branch and department leads. Your assigned work
              is on <Link href="/tasks" className="text-brand-600 hover:underline">My Work</Link>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">Requests</h1>
          <p className="text-muted-foreground">Manage and track project requests.</p>
        </div>
        <Link href="/requests/new" className="shrink-0">
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
                  <TableHead>Team</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests?.map((req) => (
                  <TableRow key={req.id}>
                    <TableCell className="whitespace-nowrap font-medium">{req.code}</TableCell>
                    {/* Titles are free text and routinely long. Cap and ellipsize
                        so one request cannot widen the whole table. */}
                    <TableCell className="max-w-[24rem] truncate" title={req.title}>
                      {req.title}
                    </TableCell>
                    <TableCell>{req.routedTeamId ? "Assigned" : "Unassigned"}</TableCell>
                    <TableCell>{getUrgencyBadge(req.urgency)}</TableCell>
                    <TableCell>{getStageBadge(req.stage)}</TableCell>
                    <TableCell className="whitespace-nowrap">{new Date(req.createdAt).toLocaleDateString()}</TableCell>
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
