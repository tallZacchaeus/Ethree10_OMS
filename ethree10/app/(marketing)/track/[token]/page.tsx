"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Clock, MessageSquare, Send } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui-ext/status-pill";
import { UrgencyTag } from "@/components/ui-ext/urgency-tag";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils/cn";

function stageLabel(stage: string) {
  return stage.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default function TrackRequestPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const { toast } = useToast();
  const [body, setBody] = useState("");

  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.track.get.useQuery(
    { token },
    { retry: false, refetchOnWindowFocus: false },
  );

  const addComment = trpc.track.addComment.useMutation({
    onSuccess: () => {
      setBody("");
      void utils.track.get.invalidate({ token });
      toast({ title: "Message sent", description: "The team has been notified." });
    },
    onError: (e) => {
      toast({ title: "Could not send", description: e.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center text-muted-foreground">
        Loading your request…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto max-w-xl px-4 py-16">
        <Card>
          <CardHeader className="items-center text-center">
            <CardTitle>Link not found</CardTitle>
            <CardDescription>
              This tracking link is invalid or has expired. Check the link from your
              confirmation email, or contact the team.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-4 py-10">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {data.code}
              </p>
              <CardTitle className="mt-1 text-2xl">{data.title}</CardTitle>
            </div>
            <StatusPill kind="request" value={data.stage} />
          </div>
          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <UrgencyTag value={data.urgency} />
            {data.teamName && <span>Handled by {data.teamName}</span>}
            <span>Submitted {formatDate(data.createdAt)}</span>
            {data.targetDeliveryDate && <span>Target delivery {formatDate(data.targetDeliveryDate)}</span>}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{data.description}</p>
        </CardContent>
      </Card>

      {/* Progress timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progress</CardTitle>
          <CardDescription>Every stage your request has moved through.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-0">
            {data.timeline.map((event, i) => {
              const isLast = i === data.timeline.length - 1;
              return (
                <li key={event.id} className="relative flex gap-3 pb-6 last:pb-0">
                  {!isLast && (
                    <span className="absolute left-[11px] top-6 h-full w-px bg-border" aria-hidden />
                  )}
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      isLast ? "bg-brand-500 text-white" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isLast ? <Clock className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{stageLabel(event.toStage)}</p>
                    {event.note && <p className="text-sm text-muted-foreground">{event.note}</p>}
                    <p className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>

      {/* Conversation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" /> Conversation
          </CardTitle>
          <CardDescription>
            Ask a question or add context — the team is notified as soon as you post.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No messages yet. Have a question about your request? Ask below.
            </p>
          ) : (
            <div className="space-y-3">
              {data.comments.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "rounded-lg p-3",
                    c.fromTeam ? "bg-brand-50 dark:bg-brand-950/40" : "bg-muted/60",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold">
                      {c.authorName}
                      {c.fromTeam && (
                        <span className="ml-2 rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-medium text-white">
                          Team
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{c.body}</p>
                </div>
              ))}
            </div>
          )}

          <form
            className="space-y-3 border-t border-border pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!body.trim()) return;
              addComment.mutate({ token, body: body.trim() });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="body">Your message</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Ask a question or share an update…"
                className="min-h-[90px]"
                maxLength={4000}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Posting as {data.requesterName ?? "the requester"}
              </p>
              <Button type="submit" disabled={addComment.isPending || !body.trim()}>
                <Send className="h-4 w-4" />
                {addComment.isPending ? "Sending…" : "Send"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
