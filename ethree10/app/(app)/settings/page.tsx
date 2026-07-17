"use client";

import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function SettingsPage() {
  const { data: me } = trpc.auth.me.useQuery();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Agency preferences, staff security, services, and templates." />

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

      {true && (
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
