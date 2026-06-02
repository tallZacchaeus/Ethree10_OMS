"use client";

import Link from "next/link";
import { isToday, isPast, differenceInCalendarDays } from "date-fns";
import { trpc, type RouterOutputs } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { StatusPill } from "@/components/ui-ext/status-pill";
import { UrgencyTag } from "@/components/ui-ext/urgency-tag";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

type Task = RouterOutputs["tasks"]["myTasks"][number];

function bucketOf(task: Task): string {
  if (task.status === "blocked") return "Blocked";
  if (task.status === "in_review") return "In review";
  if (task.dueDate) {
    const due = new Date(task.dueDate);
    if (isPast(due) && !isToday(due)) return "Overdue";
    if (isToday(due)) return "Due today";
    if (differenceInCalendarDays(due, new Date()) <= 7) return "This week";
  }
  return "Backlog";
}

const ORDER = ["Overdue", "Due today", "This week", "In review", "Blocked", "Backlog"];

export default function MyTasksPage() {
  const { data, isLoading } = trpc.tasks.myTasks.useQuery();

  const groups = new Map<string, Task[]>();
  for (const task of data ?? []) {
    const b = bucketOf(task);
    const arr = groups.get(b) ?? [];
    arr.push(task);
    groups.set(b, arr);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Tasks" description="Everything assigned to you, grouped by urgency." />

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="Nothing assigned"
          description="When work is assigned to you, it will show up here grouped by when it's due."
        />
      ) : (
        <div className="space-y-8">
          {ORDER.filter((b) => groups.has(b)).map((bucket) => (
            <section key={bucket} className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {bucket}{" "}
                <span className="text-muted-foreground/60">({groups.get(bucket)!.length})</span>
              </h2>
              <div className="space-y-2">
                {groups.get(bucket)!.map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <Card className="transition-colors hover:border-brand-300">
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{task.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {task.project.code} · {task.project.name}
                            {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <UrgencyTag value={task.priority} />
                          <StatusPill kind="task" value={task.status} />
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
