"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export default function MyContributionsPage() {
  const { data: reports, isLoading } = trpc.reports.list.useQuery({ level: "member" });
  return <div className="space-y-6"><PageHeader title="My contributions" description="Traceable task outcomes, deliverables, reviews, collaboration, and effort included in your reports." />{isLoading ? <p className="text-sm text-muted-foreground">Loading contribution history…</p> : !reports?.length ? <EmptyState title="No contribution reports yet" description="Your weekly and monthly records will appear after the first reporting cycle." /> : <div className="grid gap-4 md:grid-cols-2">{reports.map((report) => <Link key={report.id} href={`/reports/${report.id}`}><Card className="h-full hover:border-brand-400"><CardHeader><div className="flex items-center justify-between"><CardTitle className="capitalize">{report.period} contribution report</CardTitle><Badge variant={report.status === "finalized" ? "default" : "outline"}>{report.status}</Badge></div></CardHeader><CardContent className="text-sm text-muted-foreground">{formatDate(report.periodStart)} – {formatDate(report.periodEnd)}</CardContent></Card></Link>)}</div>}</div>;
}
