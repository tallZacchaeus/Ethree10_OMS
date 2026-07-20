"use client";

import Link from "next/link";
import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { useAgencyContext } from "@/components/providers/agency-provider";

export default function OrganizationsPage() {
  const { roles, isSuperAdmin } = useAgencyContext();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.organizations.listOrganizations.useQuery();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [external, setExternal] = useState(true);
  const canCreate = isSuperAdmin || roles.includes("agency_admin");
  const create = trpc.organizations.createOrganization.useMutation({
    onSuccess: () => { setOpen(false); setName(""); setDescription(""); void utils.organizations.listOrganizations.invalidate(); toast({ title: "Organization created" }); },
    onError: (error) => toast({ title: "Could not create organization", description: error.message, variant: "destructive" }),
  });

  return <div className="space-y-6">
    <PageHeader title="Organizations" description="External clients and sibling initiatives, with their complete service history." actions={canCreate ? <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="h-4 w-4" /> Add organization</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add organization</DialogTitle><DialogDescription>Create a client or sibling initiative profile for requests, projects, invoices, and reports.</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); create.mutate({ name, description: description || undefined, isExternal: external }); }}><div className="space-y-2"><Label htmlFor="org-name">Name</Label><Input id="org-name" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} /></div><div className="space-y-2"><Label htmlFor="org-description">Description</Label><Textarea id="org-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div><div className="flex items-center gap-2"><Switch id="org-external" checked={external} onCheckedChange={setExternal} /><Label htmlFor="org-external">External client</Label></div><Button type="submit" className="w-full" disabled={create.isPending || name.trim().length < 2}>Create organization</Button></form></DialogContent></Dialog> : undefined} />
    {isLoading ? <p className="text-sm text-muted-foreground">Loading organizations…</p> : !data?.length ? <EmptyState title="No organizations" description="Organizations are created here or automatically from public requests." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((organization) => <Link key={organization.id} href={`/organizations/${organization.id}`}><Card className="h-full transition-colors hover:border-brand-400"><CardHeader><div className="flex items-start justify-between gap-3"><Building2 className="h-5 w-5 text-brand-500" /><Badge variant={organization.isExternal ? "secondary" : "outline"}>{organization.isExternal ? "External" : "Internal"}</Badge></div><CardTitle>{organization.name}</CardTitle><CardDescription>{organization.description || "No description supplied."}</CardDescription></CardHeader><CardContent className="text-xs text-muted-foreground">Open service history</CardContent></Card></Link>)}</div>}
  </div>;
}
