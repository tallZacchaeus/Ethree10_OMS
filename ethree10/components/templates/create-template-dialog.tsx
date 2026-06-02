"use client";

import { useState } from "react";
import { Plus, Trash2, GripVertical } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";

const PROJECT_TYPES = [
  "website",
  "mobile_app",
  "branding",
  "campaign",
  "content",
  "video",
  "design",
  "consulting",
  "other",
];

type TaskDef = {
  title: string;
  description: string;
  estimatedHours: number | undefined;
  dependenciesByIndex: number[];
};

interface CreateTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateTemplateDialogProps) {
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [projectType, setProjectType] = useState("");
  const [tasks, setTasks] = useState<TaskDef[]>([
    { title: "", description: "", estimatedHours: undefined, dependenciesByIndex: [] },
  ]);

  const create = trpc.templates.create.useMutation({
    onSuccess: () => {
      toast({ title: "Template created successfully." });
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    },
    onError: (err) =>
      toast({
        title: "Failed to create template",
        description: err.message,
        variant: "destructive",
      }),
  });

  function resetForm() {
    setName("");
    setDescription("");
    setProjectType("");
    setTasks([{ title: "", description: "", estimatedHours: undefined, dependenciesByIndex: [] }]);
  }

  function addTask() {
    setTasks((prev) => [
      ...prev,
      { title: "", description: "", estimatedHours: undefined, dependenciesByIndex: [] },
    ]);
  }

  function removeTask(idx: number) {
    setTasks((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // Re-index dependencies
      return next.map((task) => ({
        ...task,
        dependenciesByIndex: task.dependenciesByIndex
          .filter((d) => d !== idx)
          .map((d) => (d > idx ? d - 1 : d)),
      }));
    });
  }

  function updateTask<K extends keyof TaskDef>(idx: number, field: K, value: TaskDef[K]) {
    setTasks((prev) =>
      prev.map((task, i) => (i === idx ? { ...task, [field]: value } : task)),
    );
  }

  function toggleDependency(taskIdx: number, depIdx: number) {
    setTasks((prev) =>
      prev.map((task, i) => {
        if (i !== taskIdx) return task;
        const has = task.dependenciesByIndex.includes(depIdx);
        return {
          ...task,
          dependenciesByIndex: has
            ? task.dependenciesByIndex.filter((d) => d !== depIdx)
            : [...task.dependenciesByIndex, depIdx],
        };
      }),
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Template name is required.", variant: "destructive" });
      return;
    }
    if (!projectType) {
      toast({ title: "Project type is required.", variant: "destructive" });
      return;
    }
    if (tasks.some((t) => !t.title.trim())) {
      toast({ title: "All tasks must have a title.", variant: "destructive" });
      return;
    }
    create.mutate({
      name,
      description: description || undefined,
      projectType,
      tasks: tasks.map((t) => ({
        title: t.title,
        description: t.description || undefined,
        estimatedHours: t.estimatedHours,
        dependenciesByIndex: t.dependenciesByIndex,
      })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Project Template</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Template metadata */}
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="tmpl-name">Name *</Label>
              <Input
                id="tmpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard Website Project"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tmpl-desc">Description</Label>
              <Textarea
                id="tmpl-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="When should this template be used?"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Project Type *</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project type..." />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Task definitions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Task Definitions</Label>
              <Button type="button" variant="outline" size="sm" onClick={addTask}>
                <Plus className="mr-1 h-3 w-3" />
                Add Task
              </Button>
            </div>

            {tasks.map((task, idx) => (
              <div key={idx} className="rounded-md border p-4 space-y-3 bg-muted/30">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground">
                    Task {idx + 1}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeTask(idx)}
                    disabled={tasks.length === 1}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Title *</Label>
                    <Input
                      value={task.title}
                      onChange={(e) => updateTask(idx, "title", e.target.value)}
                      placeholder="e.g. Design Mockups"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Est. Hours</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={task.estimatedHours ?? ""}
                      onChange={(e) =>
                        updateTask(
                          idx,
                          "estimatedHours",
                          e.target.value ? Number(e.target.value) : undefined,
                        )
                      }
                      placeholder="—"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={task.description}
                    onChange={(e) => updateTask(idx, "description", e.target.value)}
                    placeholder="Optional task details"
                  />
                </div>

                {idx > 0 && (
                  <div className="space-y-1">
                    <Label className="text-xs">Depends on</Label>
                    <div className="flex flex-wrap gap-2">
                      {tasks.slice(0, idx).map((dep, depIdx) => (
                        <Badge
                          key={depIdx}
                          variant={task.dependenciesByIndex.includes(depIdx) ? "default" : "outline"}
                          className="cursor-pointer select-none"
                          onClick={() => toggleDependency(idx, depIdx)}
                        >
                          Task {depIdx + 1}: {dep.title || "(untitled)"}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Create Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
