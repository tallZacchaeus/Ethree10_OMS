"use client";

import { trpc } from "@/lib/trpc/client";
import { useAgencyContext } from "@/components/providers/agency-provider";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Wallet } from "lucide-react";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "neutral"> = {
  paid: "success",
  approved: "warning",
  requested: "neutral",
  rejected: "destructive",
};

/**
 * Outbound spend against approved budgets. Delivery leads raise requests here;
 * Finance pays them. A requester can never pay their own request — the server
 * refuses, and the Pay button is hidden for them.
 */
export default function ExpensesPage() {
  const { toast } = useToast();
  const { roles, isSuperAdmin, userId } = useAgencyContext();
  const canPay = isSuperAdmin || roles.includes("finance_manager");

  const expenses = trpc.budgets.listExpenses.useQuery();

  const pay = trpc.budgets.payExpense.useMutation({
    onSuccess: () => {
      toast({ title: "Expense paid", description: "The requester has been notified." });
      void expenses.refetch();
    },
    onError: (error) => toast({ title: "Not allowed", description: error.message, variant: "destructive" }),
  });

  const rows = expenses.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Spend against approved project budgets. Every expense is capped by the budget the Chief Executive approved."
      />

      <Card>
        <CardHeader>
          <CardTitle>All spend requests</CardTitle>
          <CardDescription>
            {canPay
              ? "You can pay any request you did not raise yourself."
              : "Raised by delivery leads. Finance confirms payment."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {expenses.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}

          {!expenses.isLoading && rows.length === 0 && (
            <EmptyState
              title="No spend requests yet"
              description="Once a project budget is approved, delivery leads can request spend against it here."
            />
          )}

          {rows.map((expense) => {
            const isOwnRequest = expense.requestedById === userId;
            return (
              <div
                key={expense.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{expense.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {expense.project.code} · {expense.project.name} · requested by{" "}
                    {expense.requestedBy.name}
                    {expense.paidBy ? ` · paid by ${expense.paidBy.name}` : ""}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-semibold">
                    {expense.currency} {Number(expense.amount).toLocaleString()}
                  </span>
                  <Badge variant={STATUS_VARIANT[expense.status] ?? "neutral"}>{expense.status}</Badge>

                  {canPay && expense.status !== "paid" && expense.status !== "rejected" && (
                    <Button
                      size="sm"
                      disabled={pay.isPending || isOwnRequest}
                      title={
                        isOwnRequest
                          ? "You raised this request, so you cannot also pay it."
                          : undefined
                      }
                      onClick={() => pay.mutate({ expenseId: expense.id })}
                    >
                      <Wallet className="mr-2 h-4 w-4" />
                      Pay
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
