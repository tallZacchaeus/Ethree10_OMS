"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill } from "@/components/ui-ext/status-pill";
import { formatMoney } from "@/lib/format";

export default function InvoicesPage() {
  const { data: invoices, isLoading } = trpc.invoices.list.useQuery();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Manage billing and view payment statuses."
        actions={
          <Button asChild>
            <Link href="/invoices/new">
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Link>
          </Button>
        }
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !invoices?.length ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No invoices found.
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">
                    <Link href={`/public/invoice/${inv.code}`} className="hover:underline" target="_blank">
                      {inv.code}
                    </Link>
                  </TableCell>
                  <TableCell>{inv.workspace.name}</TableCell>
                  <TableCell>{formatMoney(Number(inv.amount), inv.currency)}</TableCell>
                  <TableCell>
                    <StatusPill kind="task" value={inv.status} /> {/* Using task for now just to render a pill */}
                  </TableCell>
                  <TableCell>
                    {new Date(inv.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
