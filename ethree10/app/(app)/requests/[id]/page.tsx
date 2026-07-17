"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { RequestStage } from "@prisma/client";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Copy } from "lucide-react";
import { labelForTaskType } from "@/lib/request-types";
import { StatusPill } from "@/components/ui-ext/status-pill";
import { UrgencyTag } from "@/components/ui-ext/urgency-tag";
import { useOrganization } from "@/components/providers/workspace-provider";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { humanize } from "@/lib/constants";
import { ProposalsTab } from "./proposals-tab";

// Allowed onward transitions per stage (mirrors the server-side guard).
const NEXT_STAGES: Partial<Record<RequestStage, RequestStage[]>> = {
  submitted: ["under_review", "needs_clarification", "rejected", "cancelled", "pending_approval"],
  needs_clarification: ["under_review", "rejected", "cancelled"],
  pending_approval: ["under_review", "scoping", "rejected", "cancelled"],
  under_review: ["scoping", "rejected", "on_hold", "cancelled"],
  scoping: ["proposal", "approved", "on_hold", "cancelled", "pending_approval"],
  proposal: ["approved", "rejected", "on_hold", "cancelled"],
  approved: ["in_progress", "cancelled"],
  in_progress: ["in_review", "on_hold", "cancelled"],
  in_review: ["delivered", "in_progress"],
  delivered: ["closed", "in_review"],
  on_hold: ["under_review", "scoping", "in_progress", "cancelled"],
};

export default function RequestDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const { roles, isSuperAdmin } = useOrganization();

  const utils = trpc.useUtils();
  const { data: request, isLoading } = trpc.requests.get.useQuery({ id });

  const isAgencyStaff =
    isSuperAdmin ||
    roles.some((r: string) => ["agency_admin", "team_head"].includes(r));

  const { data: teams } = trpc.requests.agencyTeams.useQuery(undefined, {
    retry: false,
    enabled: isAgencyStaff,
  });

  const [commentBody, setCommentBody] = useState("");
  const [internalNote, setInternalNote] = useState(false);

  const invalidate = () => utils.requests.get.invalidate({ id });

  const addComment = trpc.requests.comment.useMutation({
    onSuccess: () => {
      setCommentBody("");
      void invalidate();
    },
    onError: (err) =>
      toast({ title: "Failed to add comment", description: err.message, variant: "destructive" }),
  });

  const transition = trpc.requests.transition.useMutation({
    onSuccess: () => {
      void invalidate();
      toast({ title: "Stage updated" });
    },
    onError: (err) =>
      toast({ title: "Couldn't update stage", description: err.message, variant: "destructive" }),
  });

  const route = trpc.requests.route.useMutation({
    onSuccess: () => {
      void invalidate();
      toast({ title: "Request routed" });
    },
    onError: (err) =>
      toast({ title: "Couldn't route", description: err.message, variant: "destructive" }),
  });
  const approve = trpc.requests.approve.useMutation({ onSuccess: () => { void invalidate(); toast({ title: "Request accepted" }); }, onError: (err) => toast({ title: "Couldn't accept request", description: err.message, variant: "destructive" }) });
  const reject = trpc.requests.reject.useMutation({ onSuccess: () => { void invalidate(); toast({ title: "Request rejected" }); }, onError: (err) => toast({ title: "Couldn't reject request", description: err.message, variant: "destructive" }) });

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  }
  if (!request) {
    return <div className="py-12 text-center text-destructive">Request not found.</div>;
  }

  const nextStages = NEXT_STAGES[request.stage] ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{request.title}</h1>
            <span className="font-mono text-xs text-muted-foreground">{request.code}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            {request.organization?.name} · submitted by{" "}
            {request.submitter?.name ?? request.requesterName ?? "—"} · {formatDate(request.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill kind="request" value={request.stage} />
          <UrgencyTag value={request.urgency} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {request.stage === "pending_approval" && isAgencyStaff && (
          <div className="col-span-full rounded-md border border-amber-500 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold">Approval Required</h4>
                <p className="text-sm">This request triggered an approval rule and requires sign-off before proceeding.</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => transition.mutate({ id, toStage: "under_review" })}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => transition.mutate({ id, toStage: "rejected" })}>Reject</Button>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{request.description}</p>
            </CardContent>
          </Card>

          <Card><CardHeader><CardTitle>Requested outcome</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div><strong>Outcome</strong><p className="whitespace-pre-wrap text-muted-foreground">{request.expectedOutcome || "Not supplied"}</p></div><div><strong>Deliverables</strong><p className="whitespace-pre-wrap text-muted-foreground">{request.expectedDeliverables || "Not supplied"}</p></div><div><strong>Acceptance criteria</strong><p className="whitespace-pre-wrap text-muted-foreground">{request.acceptanceCriteria || "Not supplied"}</p></div>{request.supportingLinks.length > 0 && <div><strong>Supporting links</strong><ul className="list-disc pl-5">{request.supportingLinks.map((link) => <li key={link}><a className="text-brand-600 hover:underline" href={link} target="_blank" rel="noreferrer">{link}</a></li>)}</ul></div>}</CardContent></Card>

          <Tabs defaultValue="comments">
            <TabsList>
              <TabsTrigger value="comments">Comments</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              {(request.stage === "scoping" || request.stage === "proposal" || request.stage === "approved") && (
                <TabsTrigger value="proposals">Proposals</TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="comments" className="space-y-4 pt-4">
              {request.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                request.comments.map((comment) => {
                  const isClient = !comment.author;
                  return (
                    <div
                      key={comment.id}
                      className={
                        comment.isInternal
                          ? "rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-900/10"
                          : isClient
                            ? "rounded-lg bg-brand-50 p-4 dark:bg-brand-950/40"
                            : "rounded-lg bg-muted/50 p-4"
                      }
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          {comment.author?.name ?? comment.authorName ?? "Client"}
                          {isClient && <Badge variant="default">Client</Badge>}
                          {comment.isInternal && <Badge variant="warning">Internal</Badge>}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(comment.createdAt)}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-sm">{comment.body}</p>
                    </div>
                  );
                })
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (commentBody.trim()) {
                    addComment.mutate({ requestId: id, body: commentBody, isInternal: internalNote });
                  }
                }}
                className="space-y-3"
              >
                <Textarea
                  placeholder={internalNote ? "Add an internal note (hidden from the client)…" : "Reply — the client sees this on their tracking page…"}
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Switch id="internal-note" checked={internalNote} onCheckedChange={setInternalNote} />
                    <Label htmlFor="internal-note" className="text-sm text-muted-foreground">
                      Internal note (hidden from client)
                    </Label>
                  </div>
                  <Button type="submit" disabled={addComment.isPending || !commentBody.trim()}>
                    {addComment.isPending ? "Posting…" : internalNote ? "Post internal note" : "Reply to client"}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="timeline" className="space-y-3 pt-4">
              {request.stageEvents.map((event) => (
                <div key={event.id} className="flex gap-4 text-sm">
                  <span className="w-40 shrink-0 text-muted-foreground">
                    {formatDateTime(event.createdAt)}
                  </span>
                  <span>
                    {event.fromStage ? `${humanize(event.fromStage)} → ` : ""}
                    <span className="font-medium">{humanize(event.toStage)}</span>
                    {event.note ? ` — ${event.note}` : ""}
                  </span>
                </div>
              ))}
            </TabsContent>

            <TabsContent value="proposals">
              <ProposalsTab requestId={id} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Detail label="Task type" value={labelForTaskType(request.projectType)} />
              <Separator />
              <Detail label="Team" value={request.routedTeam?.name ?? "Unassigned"} />
              <Separator />
              <Detail label="Deadline" value={formatDate(request.deadline)} />
              <Separator />
              <Detail
                label="Budget estimate"
                value={
                  request.budgetEstimate
                    ? formatMoney(request.budgetEstimate.toString(), request.currency)
                    : "—"
                }
              />
              {request.project && (
                <>
                  <Separator />
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Project</div>
                    <Link
                      href={`/projects/${request.project.id}`}
                      className="text-sm font-medium text-brand-600 hover:underline"
                    >
                      {request.project.code}
                    </Link>
                  </div>
                </>
              )}
              {request.publicToken && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground">Client</div>
                    <p className="text-sm">
                      {request.requesterName ?? "—"}
                      {request.requesterEmail && (
                        <span className="block text-xs text-muted-foreground">{request.requesterEmail}</span>
                      )}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          `${window.location.origin}/track/${request.publicToken}`,
                        );
                        toast({ title: "Tracking link copied" });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy tracking link
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {isAgencyStaff && (
            <Card>
              <CardHeader>
                <CardTitle>Triage</CardTitle>
                <CardDescription>Route and move this request through its lifecycle.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <span className="text-xs font-medium text-muted-foreground">
                    Route to team
                  </span>
                  <Select
                    value={request.routedTeamId ?? undefined}
                    onValueChange={(teamId) => route.mutate({ id, teamId })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {(teams ?? []).map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Button type="button" onClick={() => approve.mutate({ id })} disabled={approve.isPending}>Accept request</Button>
                  <Button type="button" variant="outline" onClick={() => transition.mutate({ id, toStage: "needs_clarification", note: window.prompt("What clarification is needed?") || undefined })}>Request clarification</Button>
                  <Button type="button" variant="destructive" onClick={() => { const reason = window.prompt("Reason for rejection"); if (reason?.trim()) reject.mutate({ id, reason }); }}>Reject request</Button>
                </div>

                {nextStages.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Move to stage</span>
                    <Select onValueChange={(stage) => transition.mutate({ id, toStage: stage as RequestStage })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Transition to…" />
                      </SelectTrigger>
                      <SelectContent>
                        {nextStages.map((s) => (
                          <SelectItem key={s} value={s}>
                            {humanize(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
