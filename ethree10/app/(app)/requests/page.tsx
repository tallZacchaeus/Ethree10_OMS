"use client";


import Link from "next/link";
import { nextAction, isOverdue, formatAge } from "@/lib/request-triage";
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


/**
 * Colour by what the row needs, not by what it is. "Blocked" earns attention;
 * "done" should recede rather than compete with it.
 */
const NEXT_ACTION_TONE: Record<string, string> = {
  blocked: "font-medium text-red-600 dark:text-red-400",
  waiting: "font-medium text-amber-700 dark:text-amber-500",
  active: "text-foreground",
  done: "text-muted-foreground",
};

export default function RequestsPage() {
  const { roles, isSuperAdmin } = useAgencyContext();
  const [stageFilter, setStageFilter] = useState<RequestStage | "ALL">("ALL");

  // Same role set the router enforces via `request.read`. Anyone else may still
  // raise a request and follow their own — they just don't see the pipeline —
  // so the two queries are mutually exclusive rather than one being gated off.
  const canReadRequests =
    isSuperAdmin || roles.some((r: Role) => REQUEST_ACCESS_ROLES.includes(r));

  const pipeline = trpc.requests.list.useQuery(
    { stage: stageFilter !== "ALL" ? stageFilter : undefined },
    { enabled: canReadRequests },
  );
  const own = trpc.requests.myRequests.useQuery(undefined, { enabled: !canReadRequests });

  const requests = canReadRequests ? pipeline.data : own.data;
  const isLoading = canReadRequests ? pipeline.isLoading : own.isLoading;

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
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold tracking-tight">
            {canReadRequests ? "Requests" : "Your requests"}
          </h1>
          <p className="text-muted-foreground">
            {canReadRequests
              ? "Manage and track project requests."
              : "Requests you have raised. The wider pipeline is handled by branch and department leads."}
          </p>
        </div>
        <Link href="/requests/new" className="shrink-0">
          <Button>New Request</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="py-4">
          <div className="flex items-center gap-4">
            <div className={canReadRequests ? "w-[200px]" : "hidden"}>
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
              {canReadRequests
                ? "No requests found matching your filters."
                : "You haven't raised any requests yet."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Next action</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Age</TableHead>
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
                    <TableCell className="whitespace-nowrap">
                      {req.routedTeam?.name ?? (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {(() => {
                        const action = nextAction(req);
                        return (
                          <span className={NEXT_ACTION_TONE[action.tone]}>{action.label}</span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>{getUrgencyBadge(req.urgency)}</TableCell>
                    <TableCell>{getStageBadge(req.stage)}</TableCell>
                    <TableCell
                      className="whitespace-nowrap tabular-nums"
                      title={new Date(req.createdAt).toLocaleString()}
                    >
                      {isOverdue(req) ? (
                        <span className="font-medium text-red-600 dark:text-red-400">
                          {formatAge(new Date(req.createdAt))} overdue
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {formatAge(new Date(req.createdAt))}
                        </span>
                      )}
                    </TableCell>
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
