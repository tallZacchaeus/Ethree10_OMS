"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { formatMoney } from "@/lib/format";

type LineItem = { label: string; qty: number; unitPrice: number };

interface CreateProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requestId?: string;
  projectId?: string;
  onSuccess?: () => void;
}

export function CreateProposalDialog({
  open,
  onOpenChange,
  requestId,
  projectId,
  onSuccess,
}: CreateProposalDialogProps) {
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [currency, setCurrency] = useState<"NGN" | "USD">("NGN");
  const [terms, setTerms] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { label: "", qty: 1, unitPrice: 0 },
  ]);

  const create = trpc.proposals.create.useMutation({
    onSuccess: () => {
      toast({ title: "Proposal created successfully." });
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: (err) =>
      toast({
        title: "Failed to create proposal",
        description: err.message,
        variant: "destructive",
      }),
  });

  function resetForm() {
    setTitle("");
    setSummary("");
    setCurrency("NGN");
    setTerms("");
    setLineItems([{ label: "", qty: 1, unitPrice: 0 }]);
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, { label: "", qty: 1, unitPrice: 0 }]);
  }

  function removeLineItem(idx: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateLineItem<K extends keyof LineItem>(
    idx: number,
    field: K,
    value: LineItem[K],
  ) {
    setLineItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    );
  }

  const total = lineItems.reduce((acc, item) => acc + item.qty * item.unitPrice, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast({ title: "Title is required.", variant: "destructive" });
      return;
    }
    if (lineItems.some((i) => !i.label.trim())) {
      toast({ title: "All line items must have a label.", variant: "destructive" });
      return;
    }
    create.mutate({
      title,
      summary: summary || undefined,
      currency,
      terms: terms || undefined,
      lineItems,
      ...(requestId ? { requestId } : {}),
      ...(projectId ? { projectId } : {}),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Proposal</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Header fields */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="prop-title">Title *</Label>
              <Input
                id="prop-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Website Redesign Proposal"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prop-summary">Summary</Label>
              <Textarea
                id="prop-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Brief overview of the scope and deliverables..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Currency</Label>
              <Select
                value={currency}
                onValueChange={(v) => setCurrency(v as "NGN" | "USD")}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NGN">NGN (Naira)</SelectItem>
                  <SelectItem value="USD">USD (Dollar)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Line items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Line Items</Label>
              <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="mr-1 h-3 w-3" />
                Add Item
              </Button>
            </div>

            {lineItems.map((item, idx) => (
              <div key={idx} className="flex gap-3 items-end">
                <div className="flex-1 space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">Description</Label>}
                  <Input
                    value={item.label}
                    onChange={(e) => updateLineItem(idx, "label", e.target.value)}
                    placeholder="e.g. UI Design"
                  />
                </div>
                <div className="w-20 space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">Qty</Label>}
                  <Input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => updateLineItem(idx, "qty", Number(e.target.value))}
                  />
                </div>
                <div className="w-32 space-y-1">
                  {idx === 0 && <Label className="text-xs text-muted-foreground">Unit Price</Label>}
                  <Input
                    type="number"
                    min={0}
                    step={100}
                    value={item.unitPrice}
                    onChange={(e) => updateLineItem(idx, "unitPrice", Number(e.target.value))}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive mb-0.5"
                  onClick={() => removeLineItem(idx)}
                  disabled={lineItems.length === 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <div className="flex justify-end pt-2 border-t font-medium">
              <span className="text-muted-foreground mr-4">Total:</span>
              <span>{formatMoney(total.toString(), currency)}</span>
            </div>
          </div>

          {/* Terms */}
          <div className="space-y-2">
            <Label htmlFor="prop-terms">Terms &amp; Conditions</Label>
            <Textarea
              id="prop-terms"
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Payment terms, delivery milestones, revision policy..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Create Proposal"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
