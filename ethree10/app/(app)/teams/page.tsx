"use client";

import { useState } from "react";
import { Plus, Pencil, Archive, UserRound } from "lucide-react";
import type { Role } from "@prisma/client";
import { trpc } from "@/lib/trpc/client";
import { useAgencyContext } from "@/components/providers/agency-provider";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const NO_LEAD = "__none__";

/** Roles that make sense as a branch or department lead, in listing order. */
const LEAD_ROLES: Record<"branch" | "department", Role[]> = {
  branch: ["branch_head", "agency_admin", "super_admin"],
  department: ["department_lead", "branch_head", "agency_admin", "super_admin"],
};

interface LeadOption {
  userId: string;
  name: string;
  role: Role;
  eligible: boolean;
}

/**
 * Lead picker. Everyone on staff is selectable — a department may genuinely be
 * led by someone whose role has not been changed yet — but the people whose role
 * fits are listed first, so the obvious choice is the one at the top.
 */
function LeadSelect({
  scope,
  value,
  options,
  disabled,
  onChange,
}: {
  scope: "branch" | "department";
  value: string | null;
  options: LeadOption[];
  disabled?: boolean;
  onChange: (userId: string | null) => void;
}) {
  const ranked = [...options].sort((a, b) => {
    const rank = (o: LeadOption) => {
      const index = LEAD_ROLES[scope].indexOf(o.role);
      return index === -1 ? 99 : index;
    };
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });

  return (
    <Select
      value={value ?? NO_LEAD}
      disabled={disabled}
      onValueChange={(next) => onChange(next === NO_LEAD ? null : next)}
    >
      <SelectTrigger aria-label="Lead">
        <SelectValue placeholder="No lead assigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_LEAD}>No lead assigned</SelectItem>
        {ranked.map((option) => (
          <SelectItem key={option.userId} value={option.userId}>
            {option.name}
            {option.eligible ? "" : ` · ${option.role.replace(/_/g, " ")}`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function NewBranchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = trpc.teams.create.useMutation({
    onSuccess: () => {
      toast({ title: "Branch created" });
      void utils.teams.list.invalidate();
      setName("");
      setDescription("");
      onOpenChange(false);
    },
    onError: (e) => toast({ title: "Could not create branch", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New branch</DialogTitle>
          <DialogDescription>
            A branch is one half of the agency — Digital Media or Tech &amp; Product. Departments live
            inside it.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="b-name">Name</Label>
            <Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="b-desc">Description</Label>
            <Input id="b-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
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

interface EditTarget {
  scope: "branch" | "department";
  id: string;
  name: string;
  description: string;
  leadId: string | null;
}

function EditDialog({
  target,
  leadOptions,
  onClose,
}: {
  target: EditTarget | null;
  leadOptions: LeadOption[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Load the row's values the first time the dialog sees it, without an effect.
  if (target && loadedFor !== target.id) {
    setLoadedFor(target.id);
    setName(target.name);
    setDescription(target.description);
    setLeadId(target.leadId);
  }

  const onSuccess = () => {
    toast({ title: target?.scope === "branch" ? "Branch updated" : "Department updated" });
    void utils.teams.list.invalidate();
    setLoadedFor(null);
    onClose();
  };
  const onError = (e: { message: string }) =>
    toast({ title: "Could not save", description: e.message, variant: "destructive" });

  const updateBranch = trpc.teams.update.useMutation({ onSuccess, onError });
  const updateDepartment = trpc.subunits.update.useMutation({ onSuccess, onError });
  const isPending = updateBranch.isPending || updateDepartment.isPending;

  function save() {
    if (!target) return;
    const payload = { id: target.id, name, description: description || null, leadId };
    if (target.scope === "branch") updateBranch.mutate(payload);
    else updateDepartment.mutate(payload);
  }

  return (
    <Dialog open={Boolean(target)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {target?.scope === "branch" ? "branch" : "department"}</DialogTitle>
          <DialogDescription>
            The lead receives the work routed here and reviews what the {target?.scope ?? "unit"}{" "}
            delivers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="e-name">Name</Label>
            <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e-desc">Description</Label>
            <Input id="e-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Lead</Label>
            <LeadSelect
              scope={target?.scope ?? "department"}
              value={leadId}
              options={leadOptions}
              onChange={setLeadId}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={isPending || name.trim().length < 2} onClick={save}>
            {isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ArchiveTarget {
  scope: "branch" | "department";
  id: string;
  name: string;
  memberCount: number;
}

function ArchiveDialog({ target, onClose }: { target: ArchiveTarget | null; onClose: () => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const onSuccess = () => {
    toast({ title: `${target?.name} archived` });
    void utils.teams.list.invalidate();
    onClose();
  };
  const onError = (e: { message: string }) =>
    toast({ title: "Could not archive", description: e.message, variant: "destructive" });

  const archiveBranch = trpc.teams.archive.useMutation({ onSuccess, onError });
  const archiveDepartment = trpc.subunits.archive.useMutation({ onSuccess, onError });
  const isPending = archiveBranch.isPending || archiveDepartment.isPending;

  return (
    <Dialog open={Boolean(target)} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive {target?.name}?</DialogTitle>
          <DialogDescription>
            It stops appearing anywhere work can be routed. Nothing is deleted, and past requests,
            projects and reports keep their history.
            {target && target.memberCount > 0 ? (
              <>
                {" "}
                <strong>
                  {target.memberCount} {target.memberCount === 1 ? "person is" : "people are"}
                </strong>{" "}
                still assigned here — move them first or this will be refused.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              if (!target) return;
              if (target.scope === "branch") archiveBranch.mutate({ id: target.id });
              else archiveDepartment.mutate({ id: target.id });
            }}
          >
            {isPending ? "Archiving…" : "Archive"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddDepartment({ teamId }: { teamId: string }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const create = trpc.subunits.create.useMutation({
    onSuccess: () => {
      void utils.teams.list.invalidate();
      setName("");
    },
    onError: (e) => toast({ title: "Could not add department", description: e.message, variant: "destructive" }),
  });
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim().length >= 2) create.mutate({ teamId, name });
      }}
    >
      <Input
        aria-label="New department name"
        placeholder="New department"
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

export default function BranchesPage() {
  const { roles, isSuperAdmin } = useAgencyContext();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [archiving, setArchiving] = useState<ArchiveTarget | null>(null);

  const { data, isLoading } = trpc.teams.list.useQuery(undefined, { retry: false });

  const canManage = isSuperAdmin || roles.some((r: string) => r === "agency_admin");

  // Only fetched when it can actually be used — the picker is admin-only.
  const { data: members } = trpc.members.list.useQuery(undefined, {
    enabled: canManage,
    retry: false,
  });

  const leadOptions: LeadOption[] = (members ?? []).map((member) => ({
    userId: member.user.id,
    name: member.user.name,
    role: member.role,
    eligible: LEAD_ROLES.department.includes(member.role),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branches"
        description="The two halves of the agency, the departments inside them, and who leads each."
        actions={
          canManage ? (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" />
              New branch
            </Button>
          ) : undefined
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading branches…</p>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No branches yet"
          description="Create the first branch to organise the agency."
          action={canManage ? <Button onClick={() => setCreating(true)}>New branch</Button> : undefined}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data.map((branch) => (
            <Card key={branch.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{branch.name}</CardTitle>
                    {branch.description && <CardDescription>{branch.description}</CardDescription>}
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Edit ${branch.name}`}
                        onClick={() =>
                          setEditing({
                            scope: "branch",
                            id: branch.id,
                            name: branch.name,
                            description: branch.description ?? "",
                            leadId: branch.leadId,
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Archive ${branch.name}`}
                        onClick={() =>
                          setArchiving({
                            scope: "branch",
                            id: branch.id,
                            name: branch.name,
                            memberCount: branch.memberCount,
                          })
                        }
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="flex items-center gap-1.5 pt-1 text-sm text-muted-foreground">
                  <UserRound className="h-3.5 w-3.5" />
                  {branch.lead ? `Led by ${branch.lead.name}` : "No branch head assigned"}
                  <span aria-hidden>·</span>
                  {branch.memberCount} {branch.memberCount === 1 ? "person" : "people"}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {branch.subUnits.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No departments yet.</p>
                ) : (
                  <ul className="divide-y rounded-md border">
                    {branch.subUnits.map((department) => (
                      <li
                        key={department.id}
                        className="flex items-center justify-between gap-2 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{department.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {department.lead ? department.lead.name : "No lead"}
                            {" · "}
                            {department.memberCount}{" "}
                            {department.memberCount === 1 ? "person" : "people"}
                          </p>
                        </div>
                        {canManage ? (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Edit ${department.name}`}
                              onClick={() =>
                                setEditing({
                                  scope: "department",
                                  id: department.id,
                                  name: department.name,
                                  description: department.description ?? "",
                                  leadId: department.leadId,
                                })
                              }
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Archive ${department.name}`}
                              onClick={() =>
                                setArchiving({
                                  scope: "department",
                                  id: department.id,
                                  name: department.name,
                                  memberCount: department.memberCount,
                                })
                              }
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="neutral">{department.memberCount}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
                {canManage && <AddDepartment teamId={branch.id} />}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NewBranchDialog open={creating} onOpenChange={setCreating} />
      <EditDialog target={editing} leadOptions={leadOptions} onClose={() => setEditing(null)} />
      <ArchiveDialog target={archiving} onClose={() => setArchiving(null)} />
    </div>
  );
}
