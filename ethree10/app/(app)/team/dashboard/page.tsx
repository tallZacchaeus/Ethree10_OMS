"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { Inbox, FileText, ClipboardCheck, AlertTriangle, PauseCircle, FolderKanban } from "lucide-react";

/**
 * Branch control surface.
 *
 * Every tile is a number *and* the link to the queue that clears it. A count you
 * cannot act on is decoration; the previous version of this page was four link
 * cards with no data at all.
 */
export default function BranchDashboardPage() {
  const { data, isLoading } = trpc.execution.branchSummary.useQuery();
  const m = data?.metrics;

  const tiles = [
    {
      label: "Needs routing",
      value: m?.unrouted ?? 0,
      href: "/inbox",
      icon: Inbox,
      hint: "Client requests nobody has classified yet",
      urgent: (m?.unrouted ?? 0) > 0,
    },
    {
      label: "Briefs to review",
      value: m?.awaitingBrief ?? 0,
      href: "/team/intake",
      icon: FileText,
      hint: "Routed to your branch, awaiting scope",
      urgent: false,
    },
    {
      label: "Awaiting your review",
      value: m?.inReview ?? 0,
      href: "/team/reviews",
      icon: ClipboardCheck,
      hint: "Work submitted and waiting on a decision",
      urgent: (m?.inReview ?? 0) > 0,
    },
    {
      label: "Overdue",
      value: m?.overdue ?? 0,
      href: "/team/workload",
      icon: AlertTriangle,
      hint: "Past their due date and not done",
      urgent: (m?.overdue ?? 0) > 0,
    },
    {
      label: "Blocked",
      value: m?.blocked ?? 0,
      href: "/team/workload",
      icon: PauseCircle,
      hint: "Waiting on an answer from you or the client",
      urgent: (m?.blocked ?? 0) > 0,
    },
    {
      label: "Active projects",
      value: m?.activeProjects ?? 0,
      href: "/projects",
      icon: FolderKanban,
      hint: "In flight across your branch",
      urgent: false,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Branch dashboard"
        description={
          data?.teams.length
            ? `Intake, assignment, capacity and review for ${data.teams.map((t) => t.name).join(" and ")}.`
            : "Intake, assignment, capacity, delivery and internal review."
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your branch…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <Link key={tile.label} href={tile.href} className="group">
              <Card
                className={cn(
                  "h-full transition-colors group-hover:border-primary/40",
                  tile.urgent && tile.value > 0 && "border-amber-400 dark:border-amber-700",
                )}
              >
                <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {tile.label}
                  </CardTitle>
                  <tile.icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      tile.urgent && tile.value > 0 ? "text-amber-600" : "text-muted-foreground",
                    )}
                    aria-hidden
                  />
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tabular-nums">{tile.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{tile.hint}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Where to go next</CardTitle>
          <CardDescription>
            Triage is a daily step — client requests arrive unclassified by design, so nothing routes
            itself.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {([
            ["Intake Queue", "Classify and route new client requests.", "/inbox"],
            ["Brief Review", "Agree scope with the client, then accept.", "/team/intake"],
            ["Assignments", "Who is accountable for what.", "/team/assignments"],
            ["Workload", "Real capacity from estimates, leave and blockers.", "/team/workload"],
          ] as const).map(([title, description, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border p-3 transition-colors hover:border-primary/40"
            >
              <p className="font-medium">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
