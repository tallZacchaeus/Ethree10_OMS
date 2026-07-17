"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function MemberDetailPage() {
  const userId = useParams<{ id: string }>().id;
  const { data: member, isLoading } = trpc.members.get.useQuery({ userId });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading staff record…</p>;
  if (!member) return <p className="text-sm text-destructive">Staff member not found.</p>;
  return <div className="space-y-6"><Button variant="ghost" size="sm" asChild><Link href="/members"><ArrowLeft className="h-4 w-4" /> People</Link></Button><PageHeader title={member.name} description={member.email} /><div className="grid gap-6 md:grid-cols-2"><Card><CardHeader><CardTitle>Memberships</CardTitle></CardHeader><CardContent className="space-y-3">{member.memberships.map((membership) => <div key={membership.id} className="rounded-lg border p-3"><div className="flex justify-between gap-2"><span>{membership.team?.name ?? "Agency"}</span><Badge className="capitalize">{membership.role.replace(/_/g, " ")}</Badge></div>{membership.title && <p className="mt-1 text-sm text-muted-foreground">{membership.title}</p>}</div>)}</CardContent></Card><Card><CardHeader><CardTitle>Skills</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{member.skills.length ? member.skills.map((skill) => <Badge key={skill.id} variant="secondary">{skill.skill.name} · {skill.level}</Badge>) : <p className="text-sm text-muted-foreground">No skills recorded.</p>}</CardContent></Card></div></div>;
}
