"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useAgencyContext } from "@/components/providers/agency-provider";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { initials } from "@/lib/format";
import { humanize } from "@/lib/constants";
import type { Role } from "@prisma/client";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "agency_admin",           label: "Admin" },
  { value: "finance_admin",       label: "Executive Overview" },
  { value: "team_head", label: "Team Head" },
  { value: "team_member",          label: "Member" },

];

export default function MembersPage() {
  const { roles, isSuperAdmin } = useAgencyContext();
  const { toast } = useToast();

  const [query, setQuery]         = useState("");
  const [open, setOpen]           = useState(false);
  const [email, setEmail]         = useState("");
  const [name, setName]           = useState("");
  const [role, setRole]           = useState<Role>("team_member");
  const [title, setTitle]         = useState("");
  const [teamId, setDeptId] = useState<string>("");
  const [subUnitId, setSubUnitId] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<Role>("team_member");
  const [editTitle, setEditTitle] = useState("");
  const [editTeamId, setEditTeamId] = useState("");
  const [editSubUnitId, setEditSubUnitId] = useState("");

  const canInvite = isSuperAdmin || roles.some((r: string) =>
    ["agency_admin"].includes(r)
  );

  const { data, isLoading, refetch } = trpc.members.list.useQuery(undefined, {
    enabled: true,
    retry: false,
  });

  const { data: teams } = trpc.teams.list.useQuery(undefined, {
    enabled: open || Boolean(editingId),
  });

  const selectedDept = teams?.find(d => d.id === teamId);
  const selectedEditTeam = teams?.find(d => d.id === editTeamId);

  const invite = trpc.organizations.inviteUser.useMutation({
    onSuccess: () => {
      toast({ title: "Member invited", description: `${name} (${email}) has been added.` });
      setOpen(false);
      setEmail(""); setName(""); setTitle(""); setDeptId(""); setSubUnitId("");
      void refetch();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMember = trpc.members.updateMembership.useMutation({
    onSuccess: () => {
      toast({ title: "Member updated" });
      setEditingId(null);
      void refetch();
    },
    onError: (e) => toast({ title: "Could not update member", description: e.message, variant: "destructive" }),
  });

  const removeMember = trpc.members.removeMembership.useMutation({
    onSuccess: () => {
      toast({ title: "Member removed" });
      setRemovingId(null);
      void refetch();
    },
    onError: (e) => toast({ title: "Could not remove member", description: e.message, variant: "destructive" }),
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    invite.mutate({
      email,
      name,
      role,
      title: title || undefined,
      teamId: teamId || undefined,
      subUnitId: subUnitId || undefined,
    });
  }

  function openEdit(member: NonNullable<typeof data>[number]) {
    setEditingId(member.membershipId);
    setEditName(member.user.name);
    setEditRole(member.role);
    setEditTitle(member.title ?? "");
    setEditTeamId(member.team?.id ?? "");
    setEditSubUnitId(member.subUnit?.id ?? "");
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    updateMember.mutate({
      membershipId: editingId,
      name: editName,
      role: editRole,
      title: editTitle || null,
      teamId: editTeamId || null,
      subUnitId: editSubUnitId || null,
    });
  }

  const filtered = (data ?? []).filter((m) =>
    m.user.name.toLowerCase().includes(query.toLowerCase()) ||
    m.user.email.toLowerCase().includes(query.toLowerCase())
  );
  const removingMember = data?.find((m) => m.membershipId === removingId);

  return (
    <div className="space-y-6">
      <PageHeader title="Members" description="Ethree10 staff, roles, positions, teams, and current load." />

      <div className="flex items-center justify-between gap-4">
        <Input
          className="w-64"
          placeholder="Search members…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />

        {canInvite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite member
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Invite member</DialogTitle>
                <DialogDescription>
                  Add a staff member with a role, team, and optional job title.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="inv-name">Full name *</Label>
                    <Input
                      id="inv-name"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="Jane Doe"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="inv-email">Email *</Label>
                    <Input
                      id="inv-email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="jane@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="inv-role">Role *</Label>
                  <Select value={role} onValueChange={v => setRole(v as Role)}>
                    <SelectTrigger id="inv-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="inv-title">Job title (optional)</Label>
                  <Input
                    id="inv-title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Backend Engineer"
                  />
                </div>

                {teams && teams.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="inv-dept">Team (optional)</Label>
                      <Select value={teamId || "__none__"} onValueChange={v => { setDeptId(v === "__none__" ? "" : v); setSubUnitId(""); }}>
                        <SelectTrigger id="inv-dept">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {teams.map(d => (
                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedDept && selectedDept.subUnits.length > 0 && (
                      <div className="space-y-1">
                        <Label htmlFor="inv-sub">Sub-unit (optional)</Label>
                        <Select value={subUnitId || "__none__"} onValueChange={v => setSubUnitId(v === "__none__" ? "" : v)}>
                          <SelectTrigger id="inv-sub">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {selectedDept.subUnits.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  They will receive a magic link email to sign in — no password needed.
                </p>

                <Button type="submit" className="w-full" disabled={invite.isPending}>
                  {invite.isPending ? "Inviting…" : "Send invite"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {canInvite && (
        <>
          <Dialog open={Boolean(editingId)} onOpenChange={(nextOpen) => !nextOpen && setEditingId(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Edit member</DialogTitle>
                <DialogDescription>
                  Update this member&apos;s profile, role, title, and team assignment.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleEdit} className="space-y-4 pt-2">
                <div className="space-y-1">
                  <Label htmlFor="edit-name">Full name *</Label>
                  <Input
                    id="edit-name"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-role">Role *</Label>
                  <Select value={editRole} onValueChange={(value) => setEditRole(value as Role)}>
                    <SelectTrigger id="edit-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label htmlFor="edit-title">Job title (optional)</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(event) => setEditTitle(event.target.value)}
                    placeholder="e.g. Backend Engineer"
                  />
                </div>

                {teams && teams.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="edit-team">Team (optional)</Label>
                      <Select value={editTeamId || "__none__"} onValueChange={(value) => { setEditTeamId(value === "__none__" ? "" : value); setEditSubUnitId(""); }}>
                        <SelectTrigger id="edit-team">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {teams.map((team) => (
                            <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedEditTeam && selectedEditTeam.subUnits.length > 0 && (
                      <div className="space-y-1">
                        <Label htmlFor="edit-subunit">Sub-unit (optional)</Label>
                        <Select value={editSubUnitId || "__none__"} onValueChange={(value) => setEditSubUnitId(value === "__none__" ? "" : value)}>
                          <SelectTrigger id="edit-subunit">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">None</SelectItem>
                            {selectedEditTeam.subUnits.map((subUnit) => (
                              <SelectItem key={subUnit.id} value={subUnit.id}>{subUnit.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                )}

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditingId(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMember.isPending || editName.trim().length < 1}>
                    {updateMember.isPending ? "Saving..." : "Save changes"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={Boolean(removingId)} onOpenChange={(nextOpen) => !nextOpen && setRemovingId(null)}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Remove member</DialogTitle>
                <DialogDescription>
                  Remove {removingMember?.user.name ?? "this member"} from active access. Historical records remain attached to their account.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRemovingId(null)}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={!removingId || removeMember.isPending}
                  onClick={() => removingId && removeMember.mutate({ membershipId: removingId })}
                >
                  {removeMember.isPending ? "Removing..." : "Remove member"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading members…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No members yet"
          description={canInvite ? "Use the Invite member button above to add people." : "No members found."}
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Sub-unit</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Open tasks</TableHead>
                {canInvite && <TableHead className="w-24 text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.membershipId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback>{initials(m.user.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{m.user.name}</div>
                        <div className="text-xs text-muted-foreground">{m.user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{humanize(m.role)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.team?.name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{m.subUnit?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {m.user.skills.slice(0, 3).map((s) => (
                        <Badge key={s.skill.id} variant="neutral">{s.skill.name}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={m.openTaskCount > 8 ? "warning" : "neutral"}>
                      {m.openTaskCount}
                    </Badge>
                  </TableCell>
                  {canInvite && (
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${m.user.name}`}
                          onClick={() => openEdit(m)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Remove ${m.user.name}`}
                          onClick={() => setRemovingId(m.membershipId)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
