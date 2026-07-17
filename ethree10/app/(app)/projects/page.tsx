"use client";

import { useState } from "react";
import Link from "next/link";
import type { ProjectStatus } from "@prisma/client";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { StatusPill } from "@/components/ui-ext/status-pill";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatRelative } from "@/lib/format";
import { humanize } from "@/lib/constants";

const STATUSES: ProjectStatus[] = [
  "active",
  "in_review",
  "delivered",
  "closed",
  "on_hold",
  "cancelled",
];

export default function ProjectsPage() {
  const [status, setStatus] = useState<string>("all");
  const { data, isLoading } = trpc.projects.list.useQuery({
    status: status === "all" ? undefined : (status as ProjectStatus),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Active and delivered work across the agency." />

      <div className="w-48">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {humanize(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Projects are created automatically when a request is approved."
        />
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Team</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    <Link href={`/projects/${p.id}`}>{p.code}</Link>
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link href={`/projects/${p.id}`}>{p.name}</Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.organization.name}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p.team?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {p._count.tasks}
                  </TableCell>
                  <TableCell>
                    <StatusPill kind="project" value={p.status} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatRelative(p.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
