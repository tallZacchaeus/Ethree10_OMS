"use client";

import { useState } from "react";
import { PlusCircle, HandCoins } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

export default function SponsorshipsPage() {
  const { data: sponsorships, isLoading } = trpc.sponsorships.list.useQuery();
  const utils = trpc.useUtils();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [sponsorName, setSponsorName] = useState("");
  const [amount, setAmount] = useState("");

  const create = trpc.sponsorships.create.useMutation({
    onSuccess: () => {
      toast({ title: "Sponsorship prospect created" });
      setOpen(false);
      void utils.sponsorships.list.invalidate();
    },
  });

  const onSubmit = () => {
    create.mutate({ sponsorName, amount: Number(amount) });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sponsorships & Grants"
        description="Track funding, manage sponsor relations, and allocate grants to projects."
        actions={
          <Button onClick={() => setOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" /> Add Prospect
          </Button>
        }
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading sponsorships...</p>
      ) : sponsorships?.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          title="No sponsorships yet"
          description="Start tracking your funding prospects and grants here."
          action={<Button onClick={() => setOpen(true)}>Add Prospect</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {sponsorships?.map((s) => (
            <Card key={s.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{s.sponsorName}</CardTitle>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-2 py-1 bg-secondary rounded-full">
                    {s.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {s.currency} {Number(s.amount ?? 0).toLocaleString()}
                </div>
                {s.project && (
                  <p className="text-sm text-brand-600 mt-2">
                    Allocated to: {s.project.name}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sponsorship Prospect</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sponsor / Grant Name</label>
              <Input
                value={sponsorName}
                onChange={(e) => setSponsorName(e.target.value)}
                placeholder="e.g. Mozilla Foundation"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Amount (USD)</label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onSubmit} disabled={!sponsorName || !amount || create.isPending}>
              Save Prospect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
