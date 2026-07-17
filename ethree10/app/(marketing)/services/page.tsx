"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ServicesPage() {
  const { data: services = [], isLoading } = trpc.services.publicList.useQuery();
  const groups = Map.groupBy(services, (service) => service.team?.name || "Agency & cross-team solutions");
  return <main className="container mx-auto space-y-10 px-4 py-14"><header className="mx-auto max-w-3xl text-center"><h1 className="text-4xl font-bold">Services</h1><p className="mt-3 text-muted-foreground">Choose the closest service. Its brief and routing rules send your request directly to the responsible Ethree10 team.</p></header>{isLoading ? <p className="text-center">Loading services…</p> : Array.from(groups.entries()).map(([team, entries]) => <section key={team} className="space-y-4"><h2 className="text-2xl font-semibold">{team}</h2><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{entries.map((service) => <Card key={service.id}><CardHeader><CardTitle>{service.name}</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{service.description || "Tell us the outcome you need and our team will scope the solution."}</p><p className="text-xs text-muted-foreground">Typical response SLA: {service.defaultSlaHours ? `${service.defaultSlaHours} hours` : "confirmed during triage"}</p><Button asChild size="sm"><Link href="/request">Request this service</Link></Button></CardContent></Card>)}</div></section>)}<div className="text-center"><Button asChild><Link href="/request">Submit a request</Link></Button></div></main>;
}
