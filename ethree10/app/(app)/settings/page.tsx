"use client";

import { trpc } from "@/lib/trpc/client";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { humanize } from "@/lib/constants";
import Link from "next/link";

const TYPE_LABEL: Record<string, string> = {
  agency: "Agency",
  internal_client: "Sibling initiative",
  master_org: "Master org",
  external_client: "External client",
};

export default function SettingsPage() {
  const { data: me } = trpc.auth.me.useQuery();
  const { workspaces, activeWorkspace } = useWorkspace();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Your profile and workspace memberships." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Name" value={me?.name ?? "—"} />
          <Row label="Email" value={me?.email ?? "—"} />
          <Row label="Timezone" value={me?.timezone ?? "Africa/Lagos"} />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Weekly Capacity (hours)</span>
            <div className="flex items-center gap-2">
              <span className="font-medium">{me?.workingHoursPerWeek ?? 40}</span>
              <Button variant="ghost" size="sm" onClick={() => {
                const updated = prompt("Enter new weekly hours:", String(me?.workingHoursPerWeek ?? 40));
                if (updated && !isNaN(Number(updated))) {
                  trpc.useUtils().client.auth.updateProfile.mutate({ workingHoursPerWeek: Number(updated) }).then(() => {
                    window.location.reload();
                  });
                }
              }}>Edit</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspaces</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {workspaces.map((w) => (
            <div
              key={w.id}
              className="flex items-center justify-between rounded-md border p-3 text-sm"
            >
              <div>
                <span className="font-medium">{w.name}</span>
                {activeWorkspace?.id === w.id && (
                  <Badge variant="info" className="ml-2">
                    Active
                  </Badge>
                )}
                <div className="text-xs text-muted-foreground">{TYPE_LABEL[w.type] ?? w.type}</div>
              </div>
              <div className="flex gap-1">
                {w.roles.map((r) => (
                  <Badge key={r} variant="neutral">
                    {humanize(r)}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {workspaces.some((w) => w.type === "agency" && w.roles.some(r => ["agency_admin", "agency_lead", "super_admin"].includes(r))) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agency Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Project Templates</div>
                <div className="text-sm text-muted-foreground">Manage templates for standard project types.</div>
              </div>
              <Button variant="outline" asChild>
                <Link href="/settings/templates">Manage Templates</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
