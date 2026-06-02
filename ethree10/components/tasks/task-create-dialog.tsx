"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { AssigneePicker } from "@/components/tasks/assignee-picker";
import { TASK_PRIORITIES, humanize } from "@/lib/constants";
import type { TaskPriority } from "@prisma/client";

export function TaskCreateDialog({
  projectId,
  open,
  onOpenChange,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subUnitId, setSubUnitId] = useState<string | null>(null);
  const [assigneeUserId, setAssigneeUserId] = useState<string | null>(null);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [dueDate, setDueDate] = useState("");

  const { data: subUnits } = trpc.tasks.subUnitsForProject.useQuery(
    { projectId },
    { enabled: open },
  );

  const create = trpc.tasks.create.useMutation({
    onSuccess: () => {
      toast({ title: "Task created" });
      void utils.projects.get.invalidate({ id: projectId });
      reset();
      onOpenChange(false);
    },
    onError: (err) =>
      toast({ title: "Couldn't create task", description: err.message, variant: "destructive" }),
  });

  function reset() {
    setTitle("");
    setDescription("");
    setSubUnitId(null);
    setAssigneeUserId(null);
    setPriority("medium");
    setEstimatedHours("");
    setDueDate("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>Break the project into a unit of work.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t-title">Title</Label>
            <Input
              id="t-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Build the landing page hero"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="t-desc">Description</Label>
            <Textarea
              id="t-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sub-unit</Label>
              <Select
                value={subUnitId ?? undefined}
                onValueChange={(v) => {
                  setSubUnitId(v);
                  setAssigneeUserId(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sub-unit" />
                </SelectTrigger>
                <SelectContent>
                  {(subUnits ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {humanize(p)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Assignee</Label>
            <AssigneePicker
              subUnitId={subUnitId}
              value={assigneeUserId}
              onChange={setAssigneeUserId}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="t-hours">Estimated hours</Label>
              <Input
                id="t-hours"
                type="number"
                min="0"
                step="0.5"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-due">Due date</Label>
              <Input
                id="t-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={create.isPending || title.trim().length < 2}
            onClick={() =>
              create.mutate({
                projectId,
                title,
                description: description || undefined,
                subUnitId: subUnitId ?? undefined,
                assigneeUserId: assigneeUserId ?? undefined,
                priority,
                estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
                dueDate: dueDate ? new Date(dueDate) : undefined,
              })
            }
          >
            {create.isPending ? "Creating…" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
