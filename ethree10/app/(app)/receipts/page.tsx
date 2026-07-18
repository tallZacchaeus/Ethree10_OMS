"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";

const METHOD_LABELS: Record<string, string> = {
  paystack: "Paystack",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  cash: "Cash",
  other: "Other",
};

export default function ReceiptsPage() {
  const { data: receipts, isLoading } = trpc.receipts.list.useQuery();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receipts"
        description="Proof-of-payment documents issued to clients."
      />

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Invoice</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : !receipts?.length ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  No receipts yet. They are issued automatically when an invoice is paid.
                </TableCell>
              </TableRow>
            ) : (
              receipts.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <Link href={`/receipt/${r.code}`} className="hover:underline" target="_blank">
                      {r.code}
                    </Link>
                  </TableCell>
                  <TableCell>{r.organization.name}</TableCell>
                  <TableCell>{formatMoney(Number(r.amount), r.currency)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.invoice ? (
                      <Link href={`/invoice/${r.invoice.code}`} className="hover:underline" target="_blank">
                        {r.invoice.code}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>{new Date(r.issuedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
