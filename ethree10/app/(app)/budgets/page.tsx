"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { BadgeCheck, X } from "lucide-react";

function money(amount: string | number, currency: string) {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return `${currency} ${value.toLocaleString()}`;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "neutral"> = {
  approved: "success",
  submitted: "warning",
  rejected: "destructive",
  draft: "neutral",
};

/**
 * Budget approvals — the Chief Executive's primary action surface.
 * Approving here is what unlocks invoicing and spending on a project.
 */
export default function BudgetsPage() {
  const { toast } = useToast();
  const [note, setNote] = useState<Record<string, string>>({});

  const pending = trpc.budgets.pendingApproval.useQuery();
  const all = trpc.budgets.list.useQuery();

  const decide = trpc.budgets.decide.useMutation({
    onSuccess: (_data, variables) => {
      toast({
        title: `Budget ${variables.decision}`,
        description:
          variables.decision === "approved"
            ? "The branch can now invoice and spend against this project."
            : "The branch has been notified and can revise and resubmit.",
      });
      void pending.refetch();
      void all.refetch();
    },
    onError: (error) => toast({ title: "Not allowed", description: error.message, variant: "destructive" }),
  });

  const awaiting = pending.data ?? [];
  const decided = (all.data ?? []).filter((budget) => budget.status !== "submitted");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget approvals"
        description="Approve the money before it moves. Nothing can be invoiced or spent on a project until its budget is approved here."
      />

      <Card>
        <CardHeader>
          <CardTitle>Awaiting your decision</CardTitle>
          <CardDescription>
            Submitted by branch heads and agency admins. Approving unlocks invoicing and spend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {pending.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!pending.isLoading && awaiting.length === 0 && (
            <EmptyState
              title="Nothing awaiting approval"
              description="When a branch submits a project budget it will appear here for your decision."
            />
          )}

          {awaiting.map((budget) => (
            <div key={budget.id} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{budget.project.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {budget.project.code} · {budget.project.organization.name}
                    {budget.project.team ? ` · ${budget.project.team.name}` : ""}
                  </p>
                  <p className="mt-2 text-lg font-semibold">
                    {money(budget.amount.toString(), budget.currency)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Submitted by {budget.submittedBy?.name ?? "—"}
                    {budget.version > 1 ? ` · revision ${budget.version}` : ""}
                  </p>
                  {budget.notes && <p className="mt-2 text-sm">{budget.notes}</p>}
                </div>
                <Badge variant="warning">Awaiting approval</Badge>
              </div>

              <div className="mt-4 space-y-2">
                <Label htmlFor={`note-${budget.id}`}>Note (optional)</Label>
                <Textarea
                  id={`note-${budget.id}`}
                  value={note[budget.id] ?? ""}
                  onChange={(event) => setNote((prev) => ({ ...prev, [budget.id]: event.target.value }))}
                  placeholder="Add context for your decision — this is recorded permanently in the audit trail."
                />
              </div>

              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({ budgetId: budget.id, decision: "approved", note: note[budget.id] || null })
                  }
                >
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decide.isPending}
                  onClick={() =>
                    decide.mutate({ budgetId: budget.id, decision: "rejected", note: note[budget.id] || null })
                  }
                >
                  <X className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Decision history</CardTitle>
          <CardDescription>Every budget you have approved or rejected.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {decided.length === 0 && <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>}
          {decided.map((budget) => (
            <div key={budget.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{budget.project.name}</p>
                <p className="text-xs text-muted-foreground">
                  {money(budget.amount.toString(), budget.currency)}
                  {budget.decidedBy ? ` · decided by ${budget.decidedBy.name}` : ""}
                  {budget.decisionNote ? ` · ${budget.decisionNote}` : ""}
                </p>
              </div>
              <Badge variant={STATUS_VARIANT[budget.status] ?? "neutral"}>{budget.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
