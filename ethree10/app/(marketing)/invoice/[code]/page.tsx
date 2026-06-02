import { notFound } from "next/navigation";
import { db } from "@/server/db/client";
import { formatMoney } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, CheckCircle2 } from "lucide-react";

interface Props {
  params: { code: string };
}

export default async function PublicInvoicePage({ params }: Props) {
  const invoice = await db.invoice.findUnique({
    where: { code: params.code },
    include: { workspace: true, project: true },
  });

  if (!invoice) notFound();

  const lineItems = invoice.lineItems as Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;

  const isPaid = invoice.status === "paid";

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <Card className="shadow-lg border-2">
        <CardHeader className="flex flex-row items-center justify-between border-b pb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-2xl">Invoice {invoice.code}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Ethree10 Global</p>
            </div>
          </div>
          <div className="text-right">
            <Badge variant={isPaid ? "default" : "secondary"} className="text-lg py-1 px-4">
              {invoice.status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-8 space-y-8">
          <div className="grid grid-cols-2 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Billed To</h3>
              <p className="font-medium text-lg">{invoice.workspace.name}</p>
            </div>
            <div className="text-right">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">Amount Due</h3>
              <p className="text-3xl font-bold">{formatMoney(Number(invoice.amount), invoice.currency)}</p>
            </div>
          </div>

          <div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2">
                  <th className="py-3 font-semibold text-muted-foreground">Description</th>
                  <th className="py-3 font-semibold text-muted-foreground text-right">Qty</th>
                  <th className="py-3 font-semibold text-muted-foreground text-right">Unit Price</th>
                  <th className="py-3 font-semibold text-muted-foreground text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lineItems.map((item, i) => (
                  <tr key={i}>
                    <td className="py-4">{item.description}</td>
                    <td className="py-4 text-right">{item.quantity}</td>
                    <td className="py-4 text-right">{formatMoney(item.unitPrice, invoice.currency)}</td>
                    <td className="py-4 text-right font-medium">
                      {formatMoney(item.quantity * item.unitPrice, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t pt-8 flex justify-end">
            {!isPaid ? (
              <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6">
                Pay Now
              </Button>
            ) : (
              <div className="flex items-center text-success-600 font-medium text-lg">
                <CheckCircle2 className="mr-2 h-6 w-6" />
                Paid on {invoice.paidAt?.toLocaleDateString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
