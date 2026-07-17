"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TeamScopeSelect, useTeamScope } from "@/components/team/team-scope-select";

export default function TeamReviewsPage() {
  const scope = useTeamScope();
  const { data = [], isLoading } = trpc.execution.reviewQueue.useQuery({ teamId: scope.teamId }, { enabled: Boolean(scope.teamId) });
  return <div className="space-y-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h1 className="text-3xl font-bold">Review queue</h1><p className="text-muted-foreground">Review deliverables, specialist gates, revision history, and acceptance criteria.</p></div><TeamScopeSelect {...scope} /></div>{isLoading ? <p>Loading reviews…</p> : data.length === 0 ? <Card><CardContent className="py-10 text-center text-muted-foreground">Nothing is waiting for review.</CardContent></Card> : <div className="grid gap-4">{data.map((task) => { const required = Array.isArray(task.project.request.service?.requiredReviews) ? task.project.request.service.requiredReviews : []; return <Card key={task.id}><CardHeader><CardTitle className="flex flex-wrap items-center justify-between gap-2"><span>{task.title}</span><Badge>Revision {task.revision}</Badge></CardTitle></CardHeader><CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="space-y-2 text-sm"><p className="text-muted-foreground">{task.project.organization.name} · {task.project.name}</p><p><strong>Acceptance:</strong> {task.acceptanceCriteria || "Not specified"}</p><p><strong>Deliverables:</strong> {task.deliverables.length} · <strong>Required specialist reviews:</strong> {required.length ? required.join(", ") : "None"}</p><p><strong>Contributors:</strong> {task.contributors.map((item) => `${item.user.name} (${item.contributionRole})`).join(", ") || "Unassigned"}</p></div><Button asChild><Link href={`/tasks/${task.id}`}>Review details</Link></Button></CardContent></Card>; })}</div>}</div>;
}
