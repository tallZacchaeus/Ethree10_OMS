"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Textarea } from "@/components/ui/textarea";

export function TimeLogDialog({
  taskId,
  open,
  onOpenChange,
}: {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().substring(0, 10));

  const addTime = trpc.timeLogs.add.useMutation({
    onSuccess: () => {
      void utils.tasks.get.invalidate({ id: taskId });
      void utils.timeLogs.listForTask.invalidate(taskId);
      toast({ title: "Time logged successfully!" });
      onOpenChange(false);
      setHours("");
      setNote("");
    },
    onError: (err: { message: string }) => {
      toast({ title: "Failed to log time", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log Time</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Hours</Label>
              <Input
                type="number"
                min="0.25"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="e.g. 1.5"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you work on?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!hours || isNaN(Number(hours)) || Number(hours) <= 0 || addTime.isPending}
              onClick={() => addTime.mutate({ taskId, hours: Number(hours), note, date: new Date(date) })}
            >
              {addTime.isPending ? "Saving..." : "Save Log"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
