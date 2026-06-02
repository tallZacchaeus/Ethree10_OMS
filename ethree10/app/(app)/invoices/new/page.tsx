"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";

export default function NewInvoicePage() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: workspaces } = trpc.workspaces.list.useQuery();
  
  const [workspaceId, setWorkspaceId] = useState("");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [lineItems, setLineItems] = useState([{ description: "", quantity: 1, unitPrice: 0 }]);

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: () => {
      toast({ title: "Invoice created successfully" });
      router.push("/invoices");
    },
    onError: (err) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unitPrice: 0 }]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: "description" | "quantity" | "unitPrice", value: string | number) => {
    const newItems = [...lineItems];
    (newItems[index] as Record<string, unknown>)[field] = value;
    setLineItems(newItems);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceId) {
      toast({ title: "Please select a client workspace", variant: "destructive" });
      return;
    }
    if (lineItems.length === 0 || lineItems.some(i => !i.description)) {
      toast({ title: "Please add valid line items", variant: "destructive" });
      return;
    }

    createMutation.mutate({
      workspaceId,
      currency,
      lineItems,
    });
  };

  const total = lineItems.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <PageHeader title="Create Invoice" description="Draft a new invoice for a client." />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client Workspace</Label>
                <Select value={workspaceId} onValueChange={setWorkspaceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client..." />
                  </SelectTrigger>
                  <SelectContent>
                    {workspaces?.map((m) => (
                      <SelectItem key={m.workspace.id} value={m.workspace.id}>
                        {m.workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={currency} onValueChange={(val) => setCurrency(val as "NGN" | "USD")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN (Naira)</SelectItem>
                    <SelectItem value="USD">USD (Dollar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Line Items</h3>
            </div>
            
            {lineItems.map((item, i) => (
              <div key={i} className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Description</Label>
                  <Input 
                    value={item.description}
                    onChange={(e) => updateLineItem(i, "description", e.target.value)}
                    placeholder="e.g. Website Design"
                  />
                </div>
                <div className="w-24 space-y-2">
                  <Label>Qty</Label>
                  <Input 
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateLineItem(i, "quantity", Number(e.target.value))}
                  />
                </div>
                <div className="w-32 space-y-2">
                  <Label>Unit Price</Label>
                  <Input 
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(i, "unitPrice", Number(e.target.value))}
                  />
                </div>
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveLineItem(i)}
                  disabled={lineItems.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={handleAddLineItem}>
              <Plus className="mr-2 h-4 w-4" /> Add Item
            </Button>

            <div className="pt-4 border-t flex justify-between items-center text-lg font-medium">
              <span>Total:</span>
              <span>{new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(total)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Creating..." : "Create Invoice"}
          </Button>
        </div>
      </form>
    </div>
  );
}
