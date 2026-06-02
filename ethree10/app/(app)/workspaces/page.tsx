"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Plus, CheckCircle2 } from "lucide-react";
import type { WorkspaceType } from "@prisma/client";

const TYPE_LABELS: Record<WorkspaceType, string> = {
  agency: "Agency",
  internal_client: "Internal Client",
  master_org: "Master Organisation",
  external_client: "External Client",
};

const TYPE_COLORS: Record<WorkspaceType, string> = {
  agency: "bg-indigo-100 text-indigo-700",
  internal_client: "bg-emerald-100 text-emerald-700",
  master_org: "bg-purple-100 text-purple-700",
  external_client: "bg-orange-100 text-orange-700",
};

export default function WorkspacesPage() {
  const { isSuperAdmin, activeWorkspaceId, setActiveWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkspaceType>("internal_client");
  const [description, setDescription] = useState("");

  const { data: memberships, refetch } = trpc.workspaces.list.useQuery();

  const create = trpc.workspaces.create.useMutation({
    onSuccess: () => {
      toast({ title: "Workspace created" });
      setOpen(false);
      setName("");
      setDescription("");
      void refetch();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate({ name, type, description: description || undefined });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Workspaces</h2>
          <p className="text-sm text-muted-foreground">
            Switch context or manage workspaces you belong to.
          </p>
        </div>
        {isSuperAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create workspace</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label htmlFor="ws-name">Name</Label>
                  <Input
                    id="ws-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Micah 415"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ws-type">Type</Label>
                  <Select value={type} onValueChange={(v) => setType(v as WorkspaceType)}>
                    <SelectTrigger id="ws-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(TYPE_LABELS) as WorkspaceType[]).map((t) => (
                        <SelectItem key={t} value={t}>
                          {TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ws-desc">Description (optional)</Label>
                  <Input
                    id="ws-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  {create.isPending ? "Creating…" : "Create workspace"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {memberships?.map(({ workspace, role }) => {
          const isActive = workspace.id === activeWorkspaceId;
          return (
            <button
              key={workspace.id}
              onClick={() => setActiveWorkspace(workspace.id)}
              className={`flex items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 ${
                isActive ? "border-primary bg-primary/5" : "bg-card"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
                <Building2 className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{workspace.name}</span>
                  {isActive && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
                </div>
                <span
                  className={`mt-1 inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                    TYPE_COLORS[workspace.type]
                  }`}
                >
                  {TYPE_LABELS[workspace.type]}
                </span>
                <p className="mt-1 truncate text-xs text-muted-foreground capitalize">
                  {role.replace(/_/g, " ")}
                </p>
              </div>
            </button>
          );
        })}

        {memberships?.length === 0 && (
          <p className="col-span-full text-sm text-muted-foreground">
            You are not a member of any workspace yet.
          </p>
        )}
      </div>
    </div>
  );
}
