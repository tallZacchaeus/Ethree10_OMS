"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function InboxPage() {
  const { data: requests, isLoading } = trpc.requests.inbox.useQuery();

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "low": return <Badge variant="outline">Low</Badge>;
      case "medium": return <Badge variant="secondary">Medium</Badge>;
      case "high": return <Badge variant="default" className="bg-orange-500">High</Badge>;
      case "critical": return <Badge variant="destructive">Critical</Badge>;
      default: return <Badge variant="outline">{urgency}</Badge>;
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Agency Inbox</h1>
        <p className="text-muted-foreground">Triage new and under-review requests across all workspaces.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Needs Routing</CardTitle>
          <CardDescription>Requests that are submitted and need to be routed to a department or reviewed.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading inbox...</div>
          ) : requests?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Inbox zero! No new requests need triage.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Requester</TableHead>
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests?.map((req) => {
                  const daysOld = Math.floor((Date.now() - new Date(req.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-medium">{req.code}</TableCell>
                      <TableCell>{req.title}</TableCell>
                      <TableCell>{req.submittedById}</TableCell>
                      <TableCell>{getUrgencyBadge(req.urgency)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="uppercase">{req.stage.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell>{daysOld === 0 ? "Today" : `${daysOld} days ago`}</TableCell>
                      <TableCell className="text-right">
                        <Link href={`/requests/${req.id}`}>
                          <Button size="sm">Triage</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
