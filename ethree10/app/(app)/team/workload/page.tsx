"use client";

import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TeamScopeSelect, useTeamScope } from "@/components/team/team-scope-select";

export default function TeamWorkloadPage() {
  const scope = useTeamScope();
  const { data = [], isLoading } = trpc.execution.workload.useQuery(
    { teamId: scope.teamId },
    { enabled: Boolean(scope.teamId) },
  );
  return <div className="space-y-6">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold">Team workload</h1><p className="text-muted-foreground">Capacity from real assignments, estimates, blockers, deadlines, and availability.</p></div><TeamScopeSelect {...scope} /></div>
    {isLoading ? <p>Loading workload…</p> : data.length === 0 ? <Card><CardContent className="py-10 text-center text-muted-foreground">No active team members found.</CardContent></Card> : <div className="grid gap-4 lg:grid-cols-2">{data.map((member) => <Card key={member.userId}><CardHeader><CardTitle className="flex items-center justify-between gap-3"><span>{member.name}</span><Badge variant={member.utilizationPercent > 100 ? "destructive" : "secondary"}>{member.utilizationPercent}% utilized</Badge></CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted-foreground">Position</p><p className="font-medium">{member.position || "Not set"}</p></div><div><p className="text-muted-foreground">Availability</p><p className="font-medium capitalize">{member.availability} · {member.capacityPercent}%</p></div><div><p className="text-muted-foreground">Open work</p><p className="font-medium">{member.openTaskCount} tasks · {member.remainingHours}h</p></div><div><p className="text-muted-foreground">Risks</p><p className="font-medium">{member.blockedTaskCount} blocked · {member.overdueTaskCount} overdue</p></div></CardContent></Card>)}</div>}
  </div>;
}
