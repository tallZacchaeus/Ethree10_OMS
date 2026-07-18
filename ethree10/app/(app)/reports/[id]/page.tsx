"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, FileText, Save } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { formatDate, formatDateTime } from "@/lib/format";

const sections = ["executiveSummary", "outcomes", "qualityAndTimeliness", "collaborationAndEffort", "risksAndNextSteps"] as const;
const labels: Record<(typeof sections)[number], string> = {
  executiveSummary: "Executive summary",
  outcomes: "Outcomes",
  qualityAndTimeliness: "Quality and timeliness",
  collaborationAndEffort: "Collaboration and effort",
  risksAndNextSteps: "Risks and next steps",
};

export default function ReportViewerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: report, isLoading } = trpc.reports.get.useQuery({ id });
  const [draft, setDraft] = useState<Record<string, string>>({});
  useEffect(() => {
    if (report?.narrative && typeof report.narrative === "object" && !Array.isArray(report.narrative)) {
      setDraft(Object.fromEntries(Object.entries(report.narrative).map(([key, value]) => [key, String(value)])));
    }
  }, [report]);
  const refresh = () => utils.reports.get.invalidate({ id });
  const save = trpc.reports.updateNarrative.useMutation({ onSuccess: () => { void refresh(); toast({ title: "Narrative saved" }); }, onError: (error) => toast({ title: "Could not save", description: error.message, variant: "destructive" }) });
  const finalize = trpc.reports.finalize.useMutation({ onSuccess: () => { void refresh(); toast({ title: "Report finalized" }); }, onError: (error) => toast({ title: "Could not finalize", description: error.message, variant: "destructive" }) });

  if (isLoading || !report) return <div className="p-6 text-sm text-muted-foreground">Loading report…</div>;
  const metrics = report.metrics as Record<string, unknown>;
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2"><Link href="/reports"><ArrowLeft className="h-4 w-4" /> Reports</Link></Button>
          <h1 className="text-2xl font-semibold capitalize">{report.period} {report.level} report</h1>
          <p className="text-sm text-muted-foreground">{formatDate(report.periodStart)} – {formatDate(report.periodEnd)} · Africa/Lagos cutoff</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={report.status === "finalized" ? "default" : "outline"} className="h-7 capitalize">{report.status} · v{report.version}</Badge>
          <Button variant="outline" asChild><a href={`/api/reports/${report.id}/pdf`} target="_blank" rel="noreferrer"><FileText className="h-4 w-4" /> PDF</a></Button>
          {report.status === "draft" && <Button onClick={() => finalize.mutate({ id: report.id })} disabled={finalize.isPending}><CheckCircle2 className="h-4 w-4" /> Finalize</Button>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(metrics).map(([key, value]) => <Card key={key}><CardContent className="p-4"><p className="text-xs capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1")}</p><p className="mt-1 text-2xl font-semibold">{typeof value === "number" ? value : String(value)}</p></CardContent></Card>)}
      </div>

      <Card>
        <CardHeader><CardTitle>Narrative review</CardTitle><CardDescription>Leaders can edit draft context. Finalized reports preserve amendment history.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          {sections.map((section) => <div key={section} className="space-y-2"><Label htmlFor={section}>{labels[section]}</Label><Textarea id={section} value={draft[section] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [section]: event.target.value }))} disabled={report.status === "finalized"} /></div>)}
          {report.status === "draft" && <Button onClick={() => save.mutate({ id: report.id, narrative: draft })} disabled={save.isPending}><Save className="h-4 w-4" /> Save narrative</Button>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Traceable contributions</CardTitle><CardDescription>Outcomes, reviews, collaboration, and effort remain separate signals.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          {report.contributions.length === 0 ? <p className="text-sm text-muted-foreground">No recorded contributions in this period.</p> : report.contributions.map((item) => <div key={item.id} className="rounded-lg border p-3"><div className="flex justify-between gap-3"><p className="text-sm font-medium">{item.summary}</p><Badge variant="secondary" className="capitalize">{item.type}</Badge></div>{item.outcome && <p className="mt-1 text-sm text-muted-foreground">{item.outcome}</p>}<p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.occurredAt)}{item.effortHours ? ` · ${item.effortHours.toString()} hours` : ""}</p></div>)}
        </CardContent>
      </Card>

      {report.amendments.length > 0 && <Card><CardHeader><CardTitle>Amendment history</CardTitle></CardHeader><CardContent className="space-y-2">{report.amendments.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><p className="font-medium">{item.reason}</p><p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p></div>)}</CardContent></Card>}
    </div>
  );
}
