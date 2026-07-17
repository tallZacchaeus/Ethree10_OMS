"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState, useEffect } from "react";
import type { ReportLevel } from "@prisma/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ScorecardItem = {
  key: string;
  label: string;
  weight: number;
  evidence: string;
  target: number;
  scoringFn: "boolean" | "linearAboveTarget" | "linearBelowTarget";
};

export function ScorecardEditorDialog({
  isOpen,
  onClose,
  scorecardId,
}: {
  isOpen: boolean;
  onClose: () => void;
  scorecardId?: string;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [level, setLevel] = useState<ReportLevel>("team");
  const [scopeId, setScopeId] = useState("");
  const [items, setItems] = useState<ScorecardItem[]>([]);

  const { data: existing } = trpc.scorecards.getById.useQuery(scorecardId!, {
    enabled: !!scorecardId,
  });

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setLevel(existing.level);
      setScopeId(existing.scopeId);
      setItems(existing.items as ScorecardItem[]);
    }
  }, [existing]);

  const { data: teams } = trpc.teams.list.useQuery();

  const createScorecard = trpc.scorecards.create.useMutation({
    onSuccess: () => {
      utils.scorecards.list.invalidate();
      alert("Scorecard created");
      onClose();
    },
  });

  const updateScorecard = trpc.scorecards.update.useMutation({
    onSuccess: () => {
      utils.scorecards.list.invalidate();
      alert("Scorecard updated");
      onClose();
    },
  });

  const handleSave = () => {
    if (scorecardId) {
      updateScorecard.mutate({ id: scorecardId, name, items });
    } else {
      createScorecard.mutate({

        level,
        scopeId,
        name,
        items,
      });
    }
  };

  const addItem = () => {
    setItems([
      ...items,
      { key: "new_item", label: "New KPI", weight: 10, evidence: "milestoneDelivery", target: 0.95, scoringFn: "linearAboveTarget" },
    ]);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{scorecardId ? "Edit Scorecard" : "Create Scorecard"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Product & Tech Scorecard" />
          </div>

          {!scorecardId && (
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Level</Label>
                <Select value={level} onValueChange={(v) => setLevel(v as ReportLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="team">Team</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Scope (Department)</Label>
                <Select value={scopeId} onValueChange={setScopeId}>
                  <SelectTrigger><SelectValue placeholder="Select dept" /></SelectTrigger>
                  <SelectContent>
                    {teams?.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-4 mt-6">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-lg">KPI Items</h3>
              <Button size="sm" variant="outline" onClick={addItem}>Add Item</Button>
            </div>
            
            {items.map((item, index) => {
              const updateItem = (patch: Partial<ScorecardItem>) => {
                setItems(items.map((it, i) => i === index ? { ...it, ...patch } : it));
              };
              return (
              <div key={index} className="grid grid-cols-12 gap-2 p-3 border rounded-md">
                <div className="col-span-4">
                  <Label className="text-xs">Label</Label>
                  <Input value={item.label} onChange={(e) => updateItem({ label: e.target.value })} />
                </div>
                <div className="col-span-3">
                  <Label className="text-xs">Evidence Key</Label>
                  <Input value={item.evidence} onChange={(e) => updateItem({ evidence: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Target</Label>
                  <Input type="number" value={item.target} onChange={(e) => updateItem({ target: parseFloat(e.target.value) })} />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs">Weight</Label>
                  <Input type="number" value={item.weight} onChange={(e) => updateItem({ weight: parseFloat(e.target.value) })} />
                </div>
                <div className="col-span-1 flex items-end">
                  <Button variant="destructive" size="sm" onClick={() => setItems(items.filter((_, i) => i !== index))}>
                    X
                  </Button>
                </div>
              </div>
              );
            })}
            
            <div className="text-sm text-muted-foreground text-right">
              Total Weight: {items.reduce((acc, item) => acc + (item.weight || 0), 0)} (Should be 100)
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={createScorecard.isPending || updateScorecard.isPending}>
            Save Scorecard
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
