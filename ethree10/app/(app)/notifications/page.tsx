"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/format";

export default function NotificationsPage() {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.notifications.list.useQuery();
  const markAll = trpc.notifications.markAllRead.useMutation({ onSuccess: () => void utils.notifications.invalidate() });
  const markRead = trpc.notifications.markRead.useMutation({ onSuccess: () => void utils.notifications.invalidate() });
  const unread = data?.filter((item) => !item.readAt).length ?? 0;
  return <div className="space-y-6"><PageHeader title="Notifications" description="Assignments, mentions, reviews, delivery updates, and system alerts." actions={unread ? <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending}><CheckCheck className="h-4 w-4" /> Mark all read</Button> : undefined} />{isLoading ? <p className="text-sm text-muted-foreground">Loading notifications…</p> : !data?.length ? <EmptyState icon={Bell} title="You're all caught up" description="New operational updates will appear here." /> : <div className="space-y-3">{data.map((item) => <Card key={item.id} className={!item.readAt ? "border-brand-300 bg-brand-50/30 dark:bg-brand-950/10" : undefined}><CardContent className="flex items-start justify-between gap-4 p-4"><div><div className="flex items-center gap-2"><p className="font-medium">{item.title}</p>{!item.readAt && <Badge>New</Badge>}</div>{item.body && <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>}<p className="mt-2 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</p></div><div className="flex gap-2">{item.link && <Button size="sm" variant="outline" asChild><Link href={item.link}>Open</Link></Button>}{!item.readAt && <Button size="sm" variant="ghost" onClick={() => markRead.mutate({ ids: [item.id] })}>Mark read</Button>}</div></CardContent></Card>)}</div>}</div>;
}
