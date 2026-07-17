"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamScopeSelect, useTeamScope } from "@/components/team/team-scope-select";

export default function TeamAssignmentsPage() {
  const scope = useTeamScope();
  const { data = [], isLoading } = trpc.execution.assignments.useQuery({ teamId: scope.teamId }, { enabled: Boolean(scope.teamId) });
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold">Assignments</h1><p className="text-muted-foreground">Active accountable work and professional contribution roles.</p></div><TeamScopeSelect {...scope} /></div>{isLoading ? <p>Loading assignments…</p> : <div className="grid gap-4">{data.map((task) => <Card key={task.id}><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span>{task.title}</span><Badge>{task.status.replaceAll("_", " ")}</Badge></CardTitle></CardHeader><CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="space-y-2 text-sm"><p className="text-muted-foreground">{task.code} · {task.project.organization.name} · {task.project.name}</p><div className="flex flex-wrap gap-2">{task.contributors.length ? task.contributors.map((contributor) => <Badge key={contributor.id} variant="outline">{contributor.user.name} · {contributor.contributionRole}</Badge>) : <Badge variant="destructive">Unassigned</Badge>}</div></div><Button asChild><Link href={`/tasks/${task.id}`}>Open task</Link></Button></CardContent></Card>)}</div>}</div>;
}
