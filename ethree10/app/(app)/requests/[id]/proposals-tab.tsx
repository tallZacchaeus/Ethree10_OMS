"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { formatMoney, formatDate } from "@/lib/format";
import { useToast } from "@/components/ui/use-toast";
import { CreateProposalDialog } from "@/components/proposals/create-proposal-dialog";
import { AnimatedItem, AnimatedSection } from "@/components/ui-ext/animated";

type ProposalLineItem = { qty: number; label: string; unitPrice: number | string };

type ProposalRecord = {
  id: string;
  title: string;
};

export function ProposalsTab({ requestId }: { requestId: string }) {
  const { roles, isSuperAdmin } = useWorkspace();
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [rejectionTarget, setRejectionTarget] = useState<ProposalRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
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
    onError: (err: { message: string }) =>
      toast({ title: "Failed to send", description: err.message, variant: "destructive" }),
  });

  const accept = trpc.proposals.accept.useMutation({
    onSuccess: () => {
      toast({ title: "Proposal accepted!" });
      void refetch();
    },
    onError: (err: { message: string }) =>
      toast({ title: "Failed to accept", description: err.message, variant: "destructive" }),
  });

  const reject = trpc.proposals.reject.useMutation({
    onSuccess: () => {
      toast({ title: "Proposal rejected." });
      setRejectionTarget(null);
      setRejectionReason("");
      void refetch();
    },
    onError: (err: { message: string }) =>
      toast({ title: "Failed to reject", description: err.message, variant: "destructive" }),
  });

  function openRejectDialog(proposal: ProposalRecord) {
    setRejectionTarget(proposal);
    setRejectionReason("");
  }

  function closeRejectDialog() {
    if (reject.isPending) return;
    setRejectionTarget(null);
    setRejectionReason("");
  }

  function submitRejection() {
    if (!rejectionTarget || !rejectionReason.trim()) return;
    reject.mutate({ id: rejectionTarget.id, reason: rejectionReason.trim() });
  }

  if (isLoading) {
    return <div className="py-4 text-center text-sm text-muted-foreground">Loading proposals...</div>;
  }

  return (
    <>
      <AnimatedSection className="space-y-6 pt-4">
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
            {proposals?.map((proposal, index) => {
              const typedProposal = proposal as ProposalRecord;

              return (
                <AnimatedItem key={proposal.id} delay={index * 60}>
                  <Card className="surface-hover">
                    <CardHeader className="flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{proposal.title}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Created {formatDate(proposal.createdAt)}
                        </p>
                      </div>
                      <div className="font-semibold capitalize">{proposal.status}</div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {proposal.summary && <p className="text-sm">{proposal.summary}</p>}

                      <div className="rounded-md border p-4 text-sm">
                        <div className="mb-2 font-medium">Line Items</div>
                        <ul className="space-y-1">
                          {(proposal.lineItems as ProposalLineItem[]).map((item, idx) => (
                            <li key={idx} className="flex justify-between gap-3">
                              <span>
                                {item.qty}x {item.label}
                              </span>
                              <span>{formatMoney(item.unitPrice, proposal.currency)}</span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-4 flex justify-between border-t pt-2 font-medium">
                          <span>Total</span>
                          <span>{formatMoney(proposal.total.toString(), proposal.currency)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={proposal.pdfUrl ?? `/api/reports/proposals/${proposal.id}/pdf`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View PDF
                          </a>
                        </Button>

                        {isAgencyStaff && proposal.status === "draft" && (
                          <Button size="sm" onClick={() => send.mutate(proposal.id)} disabled={send.isPending}>
                            {send.isPending ? "Sending..." : "Send to Requester"}
                          </Button>
                        )}

                        {!isAgencyStaff && proposal.status === "sent" && (
                          <>
                            <Button size="sm" onClick={() => accept.mutate(proposal.id)} disabled={accept.isPending}>
                              {accept.isPending ? "Accepting..." : "Accept"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openRejectDialog(typedProposal)}
                              disabled={reject.isPending}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </AnimatedItem>
              );
            })}
          </div>
        )}
      </AnimatedSection>

      <CreateProposalDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        requestId={requestId}
        onSuccess={() => void refetch()}
      />

      <Dialog open={Boolean(rejectionTarget)} onOpenChange={(open) => !open && closeRejectDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject proposal</DialogTitle>
            <DialogDescription>
              Tell the agency team what needs to change so they can revise the proposal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-sm font-medium">{rejectionTarget?.title}</p>
            <Textarea
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value)}
              placeholder="Be specific about pricing, scope, timeline, or deliverables that need revision."
              className="min-h-[140px]"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeRejectDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={submitRejection}
              disabled={reject.isPending || !rejectionReason.trim()}
            >
              {reject.isPending ? "Rejecting..." : "Reject proposal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
