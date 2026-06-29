"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { TaskStatus } from "@prisma/client";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { StatusPill } from "@/components/ui-ext/status-pill";
import { UrgencyTag } from "@/components/ui-ext/urgency-tag";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { formatDate, formatDateTime } from "@/lib/format";
import { humanize } from "@/lib/constants";
import { TimeLogDialog } from "@/components/tasks/time-log-dialog";
import { Clock } from "lucide-react";

const MEMBER_STATUSES: TaskStatus[] = ["todo", "in_progress", "blocked"];

export default function TaskDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { toast } = useToast();
  const { roles, isSuperAdmin } = useWorkspace();
  const utils = trpc.useUtils();

  const { data: me } = trpc.auth.me.useQuery();
  const { data: task, isLoading } = trpc.tasks.get.useQuery({ id });
  const { data: timeLogs } = trpc.timeLogs.listForTask.useQuery(id);

  const [summary, setSummary] = useState("");
  const [evidence, setEvidence] = useState("");
  const [hours, setHours] = useState("");
  const [commentBody, setCommentBody] = useState("");
  const [reviewNote, setReviewNote] = useState("");
  const [loggingTime, setLoggingTime] = useState(false);

  const invalidate = () => utils.tasks.get.invalidate({ id });

  const transition = trpc.tasks.transition.useMutation({
    onSuccess: () => void invalidate(),
    onError: (e) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });
  const submit = trpc.tasks.submitCompletion.useMutation({
    onSuccess: () => {
      setSummary("");
      setEvidence("");
      setHours("");
      void invalidate();
      toast({ title: "Completion submitted for review" });
    },
    onError: (e) => toast({ title: "Couldn't submit", description: e.message, variant: "destructive" }),
  });
  const review = trpc.tasks.review.useMutation({
    onSuccess: () => {
      setReviewNote("");
      void invalidate();
      toast({ title: "Review recorded" });
    },
    onError: (e) => toast({ title: "Review failed", description: e.message, variant: "destructive" }),
  });
  const comment = trpc.tasks.comment.useMutation({
    onSuccess: () => {
      setCommentBody("");
      void invalidate();
    },
    onError: (e) => toast({ title: "Comment failed", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  }
  if (!task) {
    return <div className="py-12 text-center text-destructive">Task not found.</div>;
  }

  const isAssignee = me?.id === task.assigneeUserId;
  const isLead =
    isSuperAdmin ||
    roles.some((r) =>
      ["admin", "department_lead"].includes(r),
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{task.title}</h1>
            <span className="font-mono text-xs text-muted-foreground">{task.code}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/projects/${task.project.id}`} className="text-brand-600 hover:underline">
              {task.project.code} · {task.project.name}
            </Link>
            {task.subUnit ? ` · ${task.subUnit.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill kind="task" value={task.status} />
          <UrgencyTag value={task.priority} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {task.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{task.description}</p>
              </CardContent>
            </Card>
          )}

          {isAssignee && (task.status === "in_progress" || task.status === "todo" || task.status === "blocked") && (
            <Card>
              <CardHeader>
                <CardTitle>Submit completion</CardTitle>
                <CardDescription>
                  Summarize what you did. Your sub-unit lead will review it.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="summary">Summary</Label>
                  <Textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="What was delivered?"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="evidence">Evidence / link</Label>
                    <Input
                      id="evidence"
                      value={evidence}
                      onChange={(e) => setEvidence(e.target.value)}
                      placeholder="https://…"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hours">Hours spent</Label>
                    <Input
                      id="hours"
                      type="number"
                      min="0"
                      step="0.5"
                      value={hours}
                      onChange={(e) => setHours(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  disabled={submit.isPending || summary.trim().length < 2}
                  onClick={() =>
                    submit.mutate({
                      taskId: id,
                      summary,
                      evidence: evidence || undefined,
                      hoursLogged: hours ? Number(hours) : undefined,
                    })
                  }
                >
                  {submit.isPending ? "Submitting…" : "Submit for review"}
                </Button>
              </CardContent>
            </Card>
          )}

          {isLead && task.status === "in_review" && (
            <Card>
              <CardHeader>
                <CardTitle>Review completion</CardTitle>
                <CardDescription>{task.completionSummary}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.completionEvidence && (
                  <p className="text-sm">
                    Evidence:{" "}
                    <a
                      href={task.completionEvidence}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      {task.completionEvidence}
                    </a>
                  </p>
                )}
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Optional note to the assignee"
                />
                <div className="flex gap-2">
                  <Button
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate({ taskId: id, decision: "accept", note: reviewNote || undefined })
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    disabled={review.isPending}
                    onClick={() =>
                      review.mutate({
                        taskId: id,
                        decision: "request_changes",
                        note: reviewNote || undefined,
                      })
                    }
                  >
                    Request changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Comments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                task.comments.map((c) => (
                  <div key={c.id} className="rounded-lg bg-muted/50 p-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-semibold">{c.author.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(c.createdAt)}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                  </div>
                ))
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (commentBody.trim()) comment.mutate({ taskId: id, body: commentBody });
                }}
                className="space-y-2"
              >
                <Textarea
                  placeholder="Add a comment…"
                  value={commentBody}
                  onChange={(e) => setCommentBody(e.target.value)}
                />
                <Button type="submit" disabled={comment.isPending || !commentBody.trim()}>
                  Post comment
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Time Logs</CardTitle>
              {(isAssignee || isLead) && (
                <Button variant="outline" size="sm" onClick={() => setLoggingTime(true)}>
                  <Clock className="mr-2 h-4 w-4" /> Log Time
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {!timeLogs || timeLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No time logged yet.</p>
              ) : (
                timeLogs.map((log) => (
                  <div key={log.id} className="flex justify-between items-center border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <div className="font-medium text-sm">{log.user.name} <span className="text-muted-foreground font-normal ml-2">{formatDate(log.date)}</span></div>
                      {log.note && <div className="text-xs text-muted-foreground mt-0.5">{log.note}</div>}
                    </div>
                    <div className="font-semibold">{log.hours.toString()}h</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="Assignee" value={task.assignee?.name ?? "Unassigned"} />
              <Separator />
              <Row label="Due date" value={formatDate(task.dueDate)} />
              <Separator />
              <Row
                label="Estimated"
                value={task.estimatedHours ? `${task.estimatedHours.toString()}h` : "—"}
              />
              <Separator />
              <Row label="Logged" value={`${task.loggedHours.toString()}h`} />
              {task.integrationLink?.externalUrl && (
                <>
                  <Separator />
                  <div>
                    <div className="mb-1 text-xs font-medium text-muted-foreground">Plane</div>
                    <a
                      href={task.integrationLink.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand-600 hover:underline"
                    >
                      Open in Plane
                    </a>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {(isAssignee || isLead) && (
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={task.status}
                  onValueChange={(v) => transition.mutate({ taskId: id, toStatus: v as TaskStatus })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(isLead
                      ? (["todo", "in_progress", "blocked", "in_review", "done", "cancelled"] as TaskStatus[])
                      : MEMBER_STATUSES
                    ).map((s) => (
                      <SelectItem key={s} value={s}>
                        {humanize(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {task.dependencies.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Depends on</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {task.dependencies.map((d) => (
                  <Link
                    key={d.id}
                    href={`/tasks/${d.dependsOnTask.id}`}
                    className="flex items-center justify-between hover:underline"
                  >
                    <span className="truncate">{d.dependsOnTask.title}</span>
                    <StatusPill kind="task" value={d.dependsOnTask.status} />
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {loggingTime && (
        <TimeLogDialog taskId={id} open={loggingTime} onOpenChange={setLoggingTime} />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="mb-0.5 text-xs font-medium text-muted-foreground">{label}</div>
      <div>{value}</div>
    </div>
  );
}
