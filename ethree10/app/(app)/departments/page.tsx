"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

function NewDepartmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = trpc.departments.create.useMutation({
    onSuccess: () => {
      toast({ title: "Department created" });
      void utils.departments.list.invalidate();
      setName("");
      setDescription("");
      onOpenChange(false);
    },
    onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New department</DialogTitle>
          <DialogDescription>Departments organise the agency&apos;s teams.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="d-name">Name</Label>
            <Input id="d-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="d-desc">Description</Label>
            <Input id="d-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={create.isPending || name.trim().length < 2}
            onClick={() => create.mutate({ name, description: description || undefined })}
          >
            {create.isPending ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddSubUnit({ departmentId }: { departmentId: string }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const create = trpc.subunits.create.useMutation({
    onSuccess: () => {
      void utils.departments.list.invalidate();
      setName("");
    },
    onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim().length >= 2) create.mutate({ departmentId, name });
      }}
    >
      <Input
        placeholder="New sub-unit"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8"
      />
      <Button type="submit" size="sm" variant="outline" disabled={create.isPending}>
        Add
      </Button>
    </form>
  );
}

export default function DepartmentsPage() {
  const { activeWorkspaceId, roles, isSuperAdmin } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const { data, isLoading } = trpc.departments.list.useQuery(undefined, {
    enabled: Boolean(activeWorkspaceId),
    retry: false,
  });

  const canManage =
    isSuperAdmin || roles.some((r) => ["admin"].includes(r));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Departments and sub-units inside the agency."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New department
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading departments…</p>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No departments yet"
          description="Create the first department to organise the agency."
          action={canManage ? <Button onClick={() => setCreating(true)}>New department</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((d) => (
            <Card key={d.id}>
              <CardHeader>
                <CardTitle>{d.name}</CardTitle>
                {d.description && <CardDescription>{d.description}</CardDescription>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {d.subUnits.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No sub-units yet.</span>
                  ) : (
                    d.subUnits.map((s) => (
                      <Badge key={s.id} variant="neutral">
                        {s.name}
                      </Badge>
                    ))
                  )}
                </div>
                {canManage && <AddSubUnit departmentId={d.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewDepartmentDialog open={creating} onOpenChange={setCreating} />
    </div>
  );
}
