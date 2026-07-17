"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useAgencyContext } from "@/components/providers/agency-provider";

export default function PositionsPage() {
  const { roles, isSuperAdmin } = useAgencyContext();
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data } = trpc.members.positions.useQuery();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const canCreate = isSuperAdmin || roles.includes("agency_admin");
  const create = trpc.members.createPosition.useMutation({ onSuccess: () => { setOpen(false); setName(""); setDescription(""); void utils.members.positions.invalidate(); toast({ title: "Position created" }); }, onError: (error) => toast({ title: "Could not create position", description: error.message, variant: "destructive" }) });
  return <div className="space-y-6"><PageHeader title="Positions" description="Professional titles are separate from authorization roles." actions={canCreate ? <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="h-4 w-4" /> New position</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>New position</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={(event) => { event.preventDefault(); create.mutate({ name, description: description || undefined }); }}><div className="space-y-2"><Label htmlFor="position-name">Name</Label><Input id="position-name" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="position-description">Description</Label><Textarea id="position-description" value={description} onChange={(event) => setDescription(event.target.value)} /></div><Button className="w-full" type="submit" disabled={create.isPending || name.trim().length < 2}>Create</Button></form></DialogContent></Dialog> : undefined} />{!data?.length ? <EmptyState title="No positions" description="Add the agency's professional titles, such as Product Designer or Backend Engineer." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.map((position) => <Card key={position.id}><CardHeader><CardTitle>{position.name}</CardTitle><CardDescription>{position.description || "No description."}</CardDescription></CardHeader><CardContent className="text-sm text-muted-foreground">{position._count.memberships} active or historical memberships</CardContent></Card>)}</div>}</div>;
}
