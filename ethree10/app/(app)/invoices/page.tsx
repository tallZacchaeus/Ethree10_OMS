"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/ui-ext/status-pill";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

/** Days between a due date and now. Negative means not yet due. */
function daysOverdue(dueAt: string | Date | null): number | null {
  if (!dueAt) return null;
  const diff = Date.now() - new Date(dueAt).getTime();
  return Math.floor(diff / 86_400_000);
}

/** Ageing buckets, the way a finance team actually chases payment. */
function ageBucket(days: number): "current" | "1-30" | "31-60" | "60+" {
  if (days <= 0) return "current";
  if (days <= 30) return "1-30";
  if (days <= 60) return "31-60";
  return "60+";
}

export default function InvoicesPage() {
  const { data: invoices, isLoading } = trpc.invoices.list.useQuery();

  const rows = invoices ?? [];
  const outstanding = rows.filter((inv) => inv.status === "sent" || inv.status === "overdue");

  // Ageing is computed here rather than server-side so it stays correct as the
  // page sits open; these are small collections by nature.
  const buckets = { current: 0, "1-30": 0, "31-60": 0, "60+": 0 } as Record<string, number>;
  let outstandingTotal = 0;
  let overdueTotal = 0;
  for (const inv of outstanding) {
    const amount = Number(inv.amount);
    outstandingTotal += amount;
    const days = daysOverdue(inv.dueAt);
    if (days === null) {
      buckets["current"] = (buckets["current"] ?? 0) + amount;
      continue;
    }
    const bucket = ageBucket(days);
    buckets[bucket] = (buckets[bucket] ?? 0) + amount;
    if (days > 0) overdueTotal += amount;
  }

  const currency = rows[0]?.currency ?? "NGN";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Billing, payment status, and what is owed."
        actions={
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Link>
          </Button>
        }
      />

      {/* Ageing — the numbers a finance manager opens this page for. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Outstanding</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(outstandingTotal, currency)}
            </p>
            <p className="text-xs text-muted-foreground">{outstanding.length} unpaid invoices</p>
          </CardContent>
        </Card>
        <Card className={cn(overdueTotal > 0 && "border-amber-400 dark:border-amber-700")}>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Overdue</p>
            <p
              className={cn(
                "mt-1 text-2xl font-semibold tabular-nums",
                overdueTotal > 0 && "text-amber-700 dark:text-amber-500",
              )}
            >
              {formatMoney(overdueTotal, currency)}
            </p>
            <p className="text-xs text-muted-foreground">Past their due date</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">1–30 days late</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(buckets["1-30"] ?? 0, currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">60+ days late</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(buckets["60+"] ?? 0, currency)}
            </p>
            <p className="text-xs text-muted-foreground">Needs escalation</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <caption className="sr-only">
            All invoices with client, amount, status, due date and how overdue each is
          </caption>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  No invoices yet. Once a project budget is approved you can bill against it.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((inv) => {
                const days = daysOverdue(inv.dueAt);
                const isLate = (inv.status === "sent" || inv.status === "overdue") && days !== null && days > 0;
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      <Link href={`/invoices/${inv.id}`} className="hover:underline">
                        {inv.code}
                      </Link>
                    </TableCell>
                    <TableCell>{inv.organization.name}</TableCell>
                    <TableCell className="tabular-nums">
                      {formatMoney(Number(inv.amount), inv.currency)}
                    </TableCell>
                    <TableCell>
                      <StatusPill kind="invoice" value={inv.status} />
                    </TableCell>
                    <TableCell>
                      {inv.dueAt ? new Date(inv.dueAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      {inv.status === "paid" ? (
                        <span className="text-xs text-muted-foreground">Settled</span>
                      ) : isLate ? (
                        <Badge variant="default" className="bg-amber-500">
                          {days} {days === 1 ? "day" : "days"} late
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Current</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
