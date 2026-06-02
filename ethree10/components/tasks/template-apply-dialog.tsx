"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export function TemplateApplyDialog({
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
  const [selectedId, setSelectedId] = useState<string>("");

  const { data: templates, isLoading } = trpc.templates.list.useQuery();

  const apply = trpc.templates.applyTemplate.useMutation({
    onSuccess: () => {
      void utils.projects.get.invalidate({ id: projectId });
      toast({ title: "Template applied successfully!" });
      onOpenChange(false);
    },
    onError: (err: { message: string }) => {
      toast({ title: "Failed to apply template", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Project Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select a Template</label>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder={isLoading ? "Loading..." : "Choose a template"} />
              </SelectTrigger>
              <SelectContent>
                {templates?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name} ({(t.tasks as unknown[]).length} tasks)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={!selectedId || apply.isPending}
              onClick={() => apply.mutate({ templateId: selectedId, projectId })}
            >
              {apply.isPending ? "Applying..." : "Apply"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
