"use client";

import Link from "next/link";
import { CheckSquare, Inbox, FolderKanban, CheckCircle2, ArrowRight, AlertTriangle, Users } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { StatCard } from "@/components/ui-ext/stat-card";
import { StatusPill } from "@/components/ui-ext/status-pill";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { KpiWidget } from "@/components/dashboard/kpi-widget";
import { type KpiSnapshot } from "@prisma/client";

export default function DashboardPage() {
  const { roles, isSuperAdmin, activeWorkspace } = useWorkspace();

  const isAgencyLead = isSuperAdmin || roles.includes("agency_admin") || roles.includes("agency_lead");
  const isDeptLead = isAgencyLead || roles.includes("department_lead");
  const isSubUnitLead = isDeptLead || roles.includes("subunit_lead");
  const isMember = isSubUnitLead || roles.includes("member") || roles.includes("project_manager");

  const { data: myTasks } = trpc.tasks.myTasks.useQuery(undefined, { enabled: isMember });
  const { data: myWeek } = trpc.reports.myCurrentWeek.useQuery(undefined, { enabled: isMember });
  const { data: subUnitData } = trpc.dashboard.subUnitLead.useQuery(undefined, { enabled: isSubUnitLead });
  const { data: deptData } = trpc.dashboard.departmentLead.useQuery(undefined, { enabled: isDeptLead });
  const { data: agencyData } = trpc.dashboard.agencyLead.useQuery(undefined, { enabled: isAgencyLead });

  const completedThisWeek = myWeek?.metrics?.tasksCompleted ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={activeWorkspace ? `${activeWorkspace.name} overview` : "Your overview"}
      />

      {/* Member Section */}
      {isMember && (
        <div className="space-y-4">
          <h2 className="text-lg font-medium tracking-tight">My Work</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="My open tasks" value={myTasks?.length ?? 0} icon={CheckSquare} />
            <StatCard label="Completed this week" value={completedThisWeek} icon={CheckCircle2} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">My next tasks</CardTitle>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/tasks">View all <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {!myTasks || myTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nothing assigned right now.</p>
                ) : (
                  myTasks.slice(0, 5).map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-brand-300 transition-colors"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{t.title}</span>
                      </span>
                      <StatusPill kind="task" value={t.status} />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Last Week Snapshot</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-sm text-muted-foreground">Tasks Completed</span>
                  <span className="font-medium">{myWeek?.metrics?.tasksCompleted ?? 0}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-sm text-muted-foreground">On-Time Rate</span>
                  <span className="font-medium">{(myWeek?.metrics?.onTimeRate ?? 0) * 100}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Hours Logged</span>
                  <span className="font-medium">{myWeek?.metrics?.hoursLogged ?? 0}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Sub-unit Lead Section */}
      {isSubUnitLead && subUnitData && subUnitData.subUnits.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-medium tracking-tight">Sub-unit Operations</h2>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Completion Review Queue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {subUnitData.reviewQueue.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tasks awaiting review.</p>
                ) : (
                  subUnitData.reviewQueue.map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-warning-300"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{t.title}</span>
                      </span>
                      <StatusPill kind="task" value="in_review" />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Sub-unit Active Tasks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {subUnitData.activeTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active tasks in your sub-units.</p>
                ) : (
                  subUnitData.activeTasks.slice(0, 5).map((t) => (
                    <Link
                      key={t.id}
                      href={`/tasks/${t.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-brand-300"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{t.title}</span>
                      </span>
                      <StatusPill kind="task" value={t.status} />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Department Lead Section */}
      {isDeptLead && deptData && deptData.departments.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-medium tracking-tight">Department View</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Incoming Requests" value={deptData.incomingRequests.length} icon={Inbox} />
            <StatCard label="Active Projects" value={deptData.metrics.activeProjects} icon={FolderKanban} />
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <KpiWidget snapshot={deptData.kpiSnapshot as KpiSnapshot | null} />
          </div>
        </div>
      )}

      {/* Agency Lead Section */}
      {isAgencyLead && agencyData && (
        <div className="space-y-4 pt-4 border-t">
          <h2 className="text-lg font-medium tracking-tight">Agency Overview</h2>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Agency Throughput" value={agencyData.throughput} icon={CheckCircle2} />
            <StatCard label="Capacity Heatmap" value={agencyData.capacityHeatmap as string} icon={Users} />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Cross-agency Inbox</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {agencyData.crossAgencyInbox.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Inbox zero.</p>
                ) : (
                  agencyData.crossAgencyInbox.map((r) => (
                    <Link
                      key={r.id}
                      href={`/requests/${r.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-brand-300"
                    >
                      <span className="min-w-0 truncate flex items-center gap-2">
                        <span className="font-medium">{r.title}</span>
                        {r.urgency === "critical" && <AlertTriangle className="h-3 w-3 text-danger-600" />}
                      </span>
                      <StatusPill kind="request" value={r.stage} />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Top In-Flight Projects</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {agencyData.topProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No active projects.</p>
                ) : (
                  agencyData.topProjects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/projects/${p.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-brand-300"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-medium">{p.name}</span>
                        {p.department && <span className="ml-2 text-xs text-muted-foreground">{p.department.name}</span>}
                      </span>
                      <StatusPill kind="project" value={p.status} />
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
