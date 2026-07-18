"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, ExternalLink, ReceiptText } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { StatusPill } from "@/components/ui-ext/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { formatMoney } from "@/lib/format";

// Offline + online payment methods staff can record against an invoice.
const PAYMENT_METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "cash", label: "Cash" },
  { value: "paystack", label: "Paystack (manual)" },
  { value: "other", label: "Other" },
] as const;

type Method = (typeof PAYMENT_METHODS)[number]["value"];

const REF_LABEL: Record<Method, string> = {
  bank_transfer: "Transfer reference",
  cheque: "Cheque number",
  cash: "Reference (optional)",
  paystack: "Paystack reference",
  other: "Reference (optional)",
};

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: invoice, isLoading } = trpc.invoices.get.useQuery({ id });

  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState<Method>("bank_transfer");
  const [paymentRef, setPaymentRef] = useState("");

  const refresh = () => {
    void utils.invoices.get.invalidate({ id });
    void utils.invoices.list.invalidate();
  };

  const markSent = trpc.invoices.markSent.useMutation({
    onSuccess: () => { toast({ title: "Invoice marked sent" }); refresh(); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const regeneratePdf = trpc.invoices.regeneratePdf.useMutation({
    onSuccess: () => { toast({ title: "PDF regenerated" }); refresh(); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const markVoid = trpc.invoices.markVoid.useMutation({
    onSuccess: () => { toast({ title: "Invoice voided" }); refresh(); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
  const markPaid = trpc.invoices.markPaid.useMutation({
    onSuccess: (res) => {
      toast({ title: "Payment recorded", description: `Receipt ${res.receiptCode} issued.` });
      setPayOpen(false);
      setPaymentRef("");
      refresh();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <p className="text-muted-foreground py-8">Loading…</p>;
  }
  if (!invoice) {
    return <p className="text-muted-foreground py-8">Invoice not found.</p>;
  }

  const lineItems = (invoice.lineItems as unknown as LineItem[]) ?? [];
  const status = invoice.status;
  const isDraft = status === "draft";
  const isOpen = status === "sent" || status === "overdue";
  const canVoid = status === "draft" || status === "sent" || status === "overdue";
  const busy = markSent.isPending || markPaid.isPending || markVoid.isPending || regeneratePdf.isPending;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href="/invoices"><ArrowLeft className="mr-2 h-4 w-4" />Back to invoices</Link>
      </Button>

      <PageHeader
        title={`Invoice ${invoice.code}`}
        description={`${invoice.organization.name}${invoice.project ? ` · ${invoice.project.name}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill kind="invoice" value={status} />
            {isDraft && (
              <Button size="sm" onClick={() => markSent.mutate({ id: invoice.id })} disabled={busy}>
                Mark sent
              </Button>
            )}
            {isOpen && (
              <Button size="sm" onClick={() => setPayOpen(true)} disabled={busy}>
                Record payment
              </Button>
            )}
            {!isDraft && (
              <Button size="sm" variant="outline" onClick={() => regeneratePdf.mutate({ id: invoice.id })} disabled={busy}>
                Regenerate PDF
              </Button>
            )}
            {canVoid && (
              <Button size="sm" variant="outline" onClick={() => markVoid.mutate({ id: invoice.id })} disabled={busy}>
                Void
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Line items</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit price</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.map((li, i) => (
                  <TableRow key={i}>
                    <TableCell>{li.description}</TableCell>
                    <TableCell className="text-right">{li.quantity}</TableCell>
                    <TableCell className="text-right">{formatMoney(li.unitPrice, invoice.currency)}</TableCell>
                    <TableCell className="text-right">{formatMoney(li.quantity * li.unitPrice, invoice.currency)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold">{formatMoney(Number(invoice.amount), invoice.currency)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Details</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Status"><StatusPill kind="invoice" value={status} /></Row>
            <Row label="Amount">{formatMoney(Number(invoice.amount), invoice.currency)}</Row>
            <Row label="Issued">{invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString() : "—"}</Row>
            <Row label="Due">{invoice.dueAt ? new Date(invoice.dueAt).toLocaleDateString() : "—"}</Row>
            <Row label="Paid">{invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString() : "—"}</Row>
            {invoice.paymentRef && <Row label="Payment ref">{invoice.paymentRef}</Row>}
            <div className="pt-2 space-y-2">
              <Button asChild variant="outline" size="sm" className="w-full justify-start">
                <Link href={`/invoice/${invoice.code}`} target="_blank">
                  <ExternalLink className="mr-2 h-4 w-4" />Public invoice page
                </Link>
              </Button>
              {invoice.pdfUrl && (
                <Button asChild variant="outline" size="sm" className="w-full justify-start">
                  <a href={invoice.pdfUrl} target="_blank" rel="noreferrer">
                    <Download className="mr-2 h-4 w-4" />Download invoice PDF
                  </a>
                </Button>
              )}
              {invoice.receipt && (
                <Button asChild variant="outline" size="sm" className="w-full justify-start">
                  <Link href={`/receipt/${invoice.receipt.code}`} target="_blank">
                    <ReceiptText className="mr-2 h-4 w-4" />View receipt {invoice.receipt.code}
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Record an offline or manual payment for {invoice.code}. This marks the invoice
              paid and issues a receipt. Record once funds have cleared.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Payment method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as Method)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="pay-ref">{REF_LABEL[method]}</Label>
              <Input
                id="pay-ref"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                placeholder={method === "cheque" ? "e.g. 000123 · First Bank" : "Optional"}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Amount: <span className="font-medium text-foreground">{formatMoney(Number(invoice.amount), invoice.currency)}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)} disabled={markPaid.isPending}>Cancel</Button>
            <Button
              onClick={() => markPaid.mutate({ id: invoice.id, paymentMethod: method, paymentRef: paymentRef || undefined })}
              disabled={markPaid.isPending}
            >
              {markPaid.isPending ? "Recording…" : "Mark paid & issue receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
