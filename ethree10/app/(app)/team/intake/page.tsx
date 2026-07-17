"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function TeamIntakePage() {
  const { data: requests = [], isLoading } = trpc.requests.inbox.useQuery();
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Team intake</h1><p className="text-muted-foreground">Review routed briefs, request clarification, accept, reject, or re-route work.</p></div>{isLoading ? <p>Loading…</p> : requests.length === 0 ? <Card><CardContent className="py-10 text-center text-muted-foreground">No requests are waiting for triage.</CardContent></Card> : <div className="grid gap-4">{requests.map((request) => <Card key={request.id}><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span>{request.title}</span><Badge>{request.stage.replaceAll("_", " ")}</Badge></CardTitle></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-3"><div className="text-sm text-muted-foreground"><p>{request.code} · {request.organization.name}</p><p>{request.service?.name || request.projectType} · {request.routedTeam?.name || "Agency fallback"}</p></div><Button asChild><Link href={`/requests/${request.id}`}>Review brief</Link></Button></CardContent></Card>)}</div>}</div>;
}
