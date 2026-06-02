"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { StatusPill } from "@/components/ui-ext/status-pill";
import { formatDate } from "@/lib/format";

type LeadStatus = "new" | "contacted" | "converted" | "rejected";

interface LeadRow {
  id: string;
  name: string;
  email: string;
  organization: string | null;
  message: string;
  status: LeadStatus;
  createdAt: Date | string;
  workspace?: { id: string; name: string; slug: string } | null;
}

function ConvertDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: LeadRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [workspaceName, setWorkspaceName] = useState(lead.organization ?? "");
  const [requesterName, setRequesterName] = useState(lead.name);
  const [requesterEmail, setRequesterEmail] = useState(lead.email);

  const convert = trpc.leads.convertToWorkspace.useMutation({
    onSuccess: (res) => {
      toast({
        title: "Lead converted",
        description: `Workspace "${res.workspace.name}" created and ${requesterEmail} invited.`,
      });
      void utils.leads.list.invalidate();
      onOpenChange(false);
    },
    onError: (err) =>
      toast({ title: "Conversion failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convert lead to workspace</DialogTitle>
          <DialogDescription>
            Creates a client workspace and invites the requester as its admin.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input
              id="ws-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="e.g. Lightbearers Foundation"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req-name">Requester name</Label>
            <Input
              id="req-name"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="req-email">Requester email</Label>
            <Input
              id="req-email"
              type="email"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={convert.isPending || !workspaceName || !requesterEmail}
            onClick={() =>
              convert.mutate({
                leadId: lead.id,
                workspaceName,
                requesterName,
                requesterEmail,
              })
            }
          >
            {convert.isPending ? "Converting…" : "Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function LeadsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [statusFilter, setStatusFilter] = useState<"ALL" | LeadStatus>("ALL");
  const [converting, setConverting] = useState<LeadRow | null>(null);

  const { data: leads, isLoading } = trpc.leads.list.useQuery({
    status: statusFilter !== "ALL" ? statusFilter : undefined,
  });

  const updateStatus = trpc.leads.updateStatus.useMutation({
    onSuccess: () => {
      void utils.leads.list.invalidate();
      toast({ title: "Lead status updated" });
    },
    onError: (err) =>
      toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leads"
        description="Inbound project enquiries from the marketing site."
      />

      <div className="w-48">
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as "ALL" | LeadStatus)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All leads</SelectItem>
            <SelectItem value="new">New</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="converted">Converted</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Loading leads…</div>
      ) : !leads || leads.length === 0 ? (
        <EmptyState
          title="No leads yet"
          description="Enquiries submitted through the marketing site will appear here."
        />
      ) : (
        <Card>
          <CardHeader className="sr-only" />
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                      {formatDate(lead.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium">{lead.name}</TableCell>
                    <TableCell>{lead.organization || "—"}</TableCell>
                    <TableCell className="text-sm">{lead.email}</TableCell>
                    <TableCell>
                      <StatusPill kind="lead" value={lead.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Select
                          value={lead.status}
                          onValueChange={(val) =>
                            updateStatus.mutate({
                              id: lead.id,
                              status: val as LeadStatus,
                            })
                          }
                        >
                          <SelectTrigger className="w-[130px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                        {lead.status !== "converted" && (
                          <Button size="sm" onClick={() => setConverting(lead)}>
                            Convert
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {converting && (
        <ConvertDialog
          lead={converting}
          open={Boolean(converting)}
          onOpenChange={(open) => !open && setConverting(null)}
        />
      )}
    </div>
  );
}
