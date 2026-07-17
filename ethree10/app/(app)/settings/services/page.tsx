"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";

export default function ServiceCatalogPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: services = [] } = trpc.services.list.useQuery();
  const { data: teams = [] } = trpc.requests.agencyTeams.useQuery();
  const [teamId, setTeamId] = useState("fallback");
  const create = trpc.services.create.useMutation({
    onSuccess: () => { void utils.services.list.invalidate(); toast({ title: "Service created" }); },
    onError: (error) => toast({ title: "Could not create service", description: error.message, variant: "destructive" }),
  });
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Service catalog</h1><p className="text-muted-foreground">Configure routing, brief requirements, SLAs, deliverables, and reviews.</p></div>
    <Card><CardHeader><CardTitle>Add service</CardTitle></CardHeader><CardContent>
      <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); create.mutate({ name: String(data.get("name")), slug: String(data.get("slug")), description: String(data.get("description") || ""), teamId: teamId === "fallback" ? null : teamId, requiredBriefFields: ["expectedOutcome", "expectedDeliverables", "acceptanceCriteria"], expectedDeliverables: String(data.get("deliverables") || "").split(",").map((v) => v.trim()).filter(Boolean), requiredReviews: String(data.get("reviews") || "").split(",").map((v) => v.trim()).filter(Boolean), defaultUrgency: "medium", defaultSlaHours: Number(data.get("sla")) || null, isActive: true }); }}>
        <div><Label htmlFor="name">Name</Label><Input id="name" name="name" required /></div>
        <div><Label htmlFor="slug">Slug</Label><Input id="slug" name="slug" required pattern="[a-z0-9-]+" /></div>
        <div><Label>Owning team</Label><Select value={teamId} onValueChange={setTeamId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="fallback">Agency fallback</SelectItem>{teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="sla">Default SLA (hours)</Label><Input id="sla" name="sla" type="number" min="1" /></div>
        <div><Label htmlFor="deliverables">Expected deliverables (comma-separated)</Label><Input id="deliverables" name="deliverables" /></div>
        <div><Label htmlFor="reviews">Required reviews (comma-separated)</Label><Input id="reviews" name="reviews" /></div>
        <div className="md:col-span-2"><Label htmlFor="description">Description</Label><Input id="description" name="description" /></div>
        <Button type="submit" disabled={create.isPending}>Add service</Button>
      </form>
    </CardContent></Card>
    <div className="grid gap-4 md:grid-cols-2">{services.map((service) => <Card key={service.id}><CardHeader><CardTitle className="flex items-center justify-between text-lg"><span>{service.name}</span><Badge variant={service.isActive ? "default" : "secondary"}>{service.isActive ? "Active" : "Inactive"}</Badge></CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>{service.description || "No description"}</p><p><strong>Routes to:</strong> {service.team?.name || "Agency fallback"}</p><p><strong>SLA:</strong> {service.defaultSlaHours ? `${service.defaultSlaHours} hours` : "Not set"}</p><p><strong>Requests:</strong> {service._count.requests}</p></CardContent></Card>)}</div>
  </div>;
}
