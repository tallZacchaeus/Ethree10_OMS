"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldAlert, ShieldCheck } from "lucide-react";

/**
 * Which services this branch can actually deliver.
 *
 * Auto-proposal only works where somebody is recorded as able to deliver the
 * service — with nobody recorded it stays silent by design, since a proposal
 * drawn from no data looks considered and gets waved through. That makes an
 * uncovered service invisible in the flow it affects, so it is surfaced here
 * instead: this is the screen a branch head is on when thinking about who can
 * take what.
 *
 * Step 5 of docs/service-assignment-plan.md.
 */
export function CapabilityCoverage({ teamId }: { teamId: string | null }) {
  const { data, isLoading } = trpc.services.capabilityMatrix.useQuery(
    { teamId },
    { enabled: Boolean(teamId) },
  );

  if (!teamId || isLoading) return null;

  const rows = data ?? [];
  if (rows.length === 0) return null;

  const uncovered = rows.filter((row) => row.uncovered);
  const covered = rows.length - uncovered.length;

  return (
    <Card className={uncovered.length > 0 ? "border-amber-300 dark:border-amber-900/60" : undefined}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          {uncovered.length > 0 ? (
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
          )}
          <CardTitle className="text-lg">Service coverage</CardTitle>
          <Badge variant={uncovered.length > 0 ? "warning" : "success"}>
            {covered}/{rows.length} covered
          </Badge>
        </div>
        <CardDescription>
          {uncovered.length > 0
            ? "Work for these services cannot be proposed automatically — nobody is recorded as able to deliver them."
            : "Every service in this branch has somebody recorded who can deliver it."}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {uncovered.length > 0 && (
          <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-950/40">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
              No one recorded
            </p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {uncovered.map((row) => (
                <li key={row.service.id}>
                  <Badge variant="outline" className="border-amber-400 text-amber-900 dark:text-amber-200">
                    {row.service.name}
                  </Badge>
                </li>
              ))}
            </ul>
            <Button asChild size="sm" variant="outline" className="mt-3">
              <Link href="/settings/services">Record who can deliver these</Link>
            </Button>
          </div>
        )}

        {covered > 0 && (
          <ul className="space-y-1.5">
            {rows
              .filter((row) => !row.uncovered)
              .map((row) => (
                <li key={row.service.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{row.service.name}</span>
                  <span className="min-w-0 text-muted-foreground">
                    {row.people.map((person) => `${person.name} (${person.level})`).join(", ")}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
