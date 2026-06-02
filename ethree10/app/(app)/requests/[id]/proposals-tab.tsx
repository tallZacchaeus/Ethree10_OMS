"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { formatMoney, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import { CreateProposalDialog } from "@/components/proposals/create-proposal-dialog";

type ProposalLineItem = { qty: number; label: string; unitPrice: number | string };

export function ProposalsTab({ requestId }: { requestId: string }) {
  const { roles, isSuperAdmin } = useWorkspace();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const isAgencyStaff =
    isSuperAdmin ||
    roles.some((r) =>
      ["agency_admin", "agency_lead", "department_lead", "project_manager"].includes(r),
    );

  const { data: proposals, isLoading, refetch } = trpc.proposals.list.useQuery({ requestId });

  const send = trpc.proposals.send.useMutation({
    onSuccess: () => {
      toast({ title: "Proposal sent to requester." });
      void refetch();
    },
    onError: (err: { message: string }) => toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  const accept = trpc.proposals.accept.useMutation({
    onSuccess: () => {
      toast({ title: "Proposal accepted!" });
      void refetch();
    },
    onError: (err: { message: string }) => toast({ title: "Failed to accept", description: err.message, variant: "destructive" }),
  });

  const reject = trpc.proposals.reject.useMutation({
    onSuccess: () => {
      toast({ title: "Proposal rejected." });
      void refetch();
    },
    onError: (err: { message: string }) => toast({ title: "Failed to reject", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="py-4 text-center text-sm text-muted-foreground">Loading proposals...</div>;

  return (
    <div className="space-y-6 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Proposals</h3>
        {isAgencyStaff && (
          <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(true)}>
            Create Proposal
          </Button>
        )}
      </div>

      {proposals?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No proposals have been created yet.</p>
      ) : (
        <div className="grid gap-4">
          {proposals?.map((p) => (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">{p.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">Created {formatDate(p.createdAt)}</p>
                </div>
                <div className="capitalize font-semibold">{p.status}</div>
              </CardHeader>
              <CardContent className="space-y-4">
                {p.summary && <p className="text-sm">{p.summary}</p>}
                
                <div className="rounded-md border p-4 text-sm">
                  <div className="mb-2 font-medium">Line Items</div>
                  <ul className="space-y-1">
                    {(p.lineItems as ProposalLineItem[]).map((item, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>{item.qty}x {item.label}</span>
                        <span>{formatMoney(item.unitPrice, p.currency)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 flex justify-between border-t pt-2 font-medium">
                    <span>Total</span>
                    <span>{formatMoney(p.total.toString(), p.currency)}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={p.pdfUrl ?? `/api/reports/proposals/${p.id}/pdf`} target="_blank" rel="noreferrer">
                      View PDF
                    </a>
                  </Button>
                  
                  {isAgencyStaff && p.status === "draft" && (
                    <Button size="sm" onClick={() => send.mutate(p.id)} disabled={send.isPending}>
                      {send.isPending ? "Sending..." : "Send to Requester"}
                    </Button>
                  )}
                  
                  {!isAgencyStaff && p.status === "sent" && (
                    <>
                      <Button size="sm" onClick={() => accept.mutate(p.id)} disabled={accept.isPending}>
                        Accept
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        const reason = window.prompt("Reason for rejection:");
                        if (reason) reject.mutate({ id: p.id, reason });
                      }} disabled={reject.isPending}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <CreateProposalDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        requestId={requestId}
        onSuccess={() => void refetch()}
      />
    </div>
  );
}
