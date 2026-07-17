"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, BarChart3, FileText, FolderKanban, ReceiptText } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { StatCard } from "@/components/ui-ext/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

export default function OrganizationDetailPage() {
  const id = useParams<{ id: string }>().id;
  const { data: organization, isLoading } = trpc.organizations.getOrganization.useQuery({ id });
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading organization…</p>;
  if (!organization) return <p className="text-sm text-destructive">Organization not found.</p>;
  return <div className="space-y-6">
    <Button variant="ghost" size="sm" asChild><Link href="/organizations"><ArrowLeft className="h-4 w-4" /> Organizations</Link></Button>
    <PageHeader title={organization.name} description={organization.description || "Organization service history and outcomes."} />
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"><StatCard label="Requests" value={organization._count.requests} icon={FileText} /><StatCard label="Projects" value={organization._count.projects} icon={FolderKanban} /><StatCard label="Reports" value={organization._count.reports} icon={BarChart3} /><StatCard label="Invoices" value={organization._count.invoices} icon={ReceiptText} /><StatCard label="Receipts" value={organization._count.receipts} icon={ReceiptText} /></div>
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader><CardTitle>Recent requests</CardTitle></CardHeader><CardContent className="space-y-3">{organization.requests.length ? organization.requests.map((request) => <Link key={request.id} href={`/requests/${request.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:border-brand-400"><div><p className="font-medium">{request.title}</p><p className="text-xs text-muted-foreground">{request.code} · {formatDate(request.createdAt)}</p></div><Badge className="capitalize" variant="secondary">{request.stage.replace(/_/g, " ")}</Badge></Link>) : <p className="text-sm text-muted-foreground">No requests yet.</p>}</CardContent></Card><Card><CardHeader><CardTitle>Active and recent projects</CardTitle></CardHeader><CardContent className="space-y-3">{organization.projects.length ? organization.projects.map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:border-brand-400"><div><p className="font-medium">{project.name}</p><p className="text-xs text-muted-foreground">{project.code}{project.targetDeliveryDate ? ` · due ${formatDate(project.targetDeliveryDate)}` : ""}</p></div><Badge className="capitalize" variant="secondary">{project.status.replace(/_/g, " ")}</Badge></Link>) : <p className="text-sm text-muted-foreground">No projects yet.</p>}</CardContent></Card></div>
    <Card><CardHeader><CardTitle>Service reports</CardTitle></CardHeader><CardContent className="space-y-3">{organization.reports.length ? organization.reports.map((report) => <Link key={report.id} href={`/reports/${report.id}`} className="flex items-center justify-between rounded-lg border p-3 hover:border-brand-400"><span className="capitalize">{report.period} report · {formatDate(report.periodStart)} – {formatDate(report.periodEnd)}</span><Badge variant={report.status === "finalized" ? "default" : "outline"}>{report.status}</Badge></Link>) : <p className="text-sm text-muted-foreground">No reports generated yet.</p>}</CardContent></Card>
  </div>;
}
