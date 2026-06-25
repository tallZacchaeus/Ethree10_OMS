"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/components/providers/workspace-provider";
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
import { UserPlus } from "lucide-react";
import { initials } from "@/lib/format";
import { humanize } from "@/lib/constants";
import type { Role } from "@prisma/client";

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: "agency_admin",       label: "Agency Admin" },
  { value: "agency_lead",        label: "Agency Lead" },
  { value: "department_lead",    label: "Department Lead" },
  { value: "subunit_lead",       label: "Sub-unit Lead" },
  { value: "project_manager",    label: "Project Manager" },
  { value: "member",             label: "Member" },
  { value: "requester_admin",    label: "Requester Admin (client)" },
  { value: "requester_member",   label: "Requester Member (client)" },
  { value: "requester_observer", label: "Requester Observer (client)" },
];

export default function MembersPage() {
  const { activeWorkspaceId, roles, isSuperAdmin } = useWorkspace();
  const { toast } = useToast();

  const [query, setQuery]         = useState("");
  const [open, setOpen]           = useState(false);
  const [email, setEmail]         = useState("");
  const [name, setName]           = useState("");
  const [role, setRole]           = useState<Role>("member");
  const [title, setTitle]         = useState("");
  const [departmentId, setDeptId] = useState<string>("");
  const [subUnitId, setSubUnitId] = useState<string>("");

  const canInvite = isSuperAdmin || roles.some(r =>
    ["agency_admin", "agency_lead"].includes(r)
  );

  const { data, isLoading, refetch } = trpc.members.list.useQuery(undefined, {
    enabled: Boolean(activeWorkspaceId),
    retry: false,
  });

  const { data: departments } = trpc.departments.list.useQuery(undefined, {
    enabled: Boolean(activeWorkspaceId) && open,
  });

  const selectedDept = departments?.find(d => d.id === departmentId);

  const invite = trpc.workspaces.inviteUser.useMutation({
    onSuccess: () => {
      toast({ title: "Member invited", description: `${name} (${email}) has been added.` });
      setOpen(false);
      setEmail(""); setName(""); setTitle(""); setDeptId(""); setSubUnitId("");
      void refetch();
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    invite.mutate({
      email,
      name,
      role,
      title: title || undefined,
      departmentId: departmentId || undefined,
      subUnitId: subUnitId || undefined,
    });
  }

  const filtered = (data ?? []).filter((m) =>
    m.user.name.toLowerCase().includes(query.toLowerCase()) ||
    m.user.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Members" description="People in this workspace and their current load." />

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

                {departments && departments.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="inv-dept">Department (optional)</Label>
                      <Select value={departmentId || "__none__"} onValueChange={v => { setDeptId(v === "__none__" ? "" : v); setSubUnitId(""); }}>
                        <SelectTrigger id="inv-dept">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {departments.map(d => (
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
                <TableHead>Department</TableHead>
                <TableHead>Sub-unit</TableHead>
                <TableHead>Skills</TableHead>
                <TableHead>Open tasks</TableHead>
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
                  <TableCell className="text-sm text-muted-foreground">{m.department?.name ?? "—"}</TableCell>
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
