"use client";

import { useState } from "react";
import { Plug, RefreshCw } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { formatRelative } from "@/lib/format";
import { humanize } from "@/lib/constants";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive" | "neutral"> = {
  active: "success",
  degraded: "warning",
  error: "destructive",
  disconnected: "neutral",
};

function ConnectPlaneDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: teams } = trpc.requests.agencyTeams.useQuery(undefined, { enabled: open });

  const [name, setName] = useState("Plane — Product & Tech");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState("https://api.plane.so");
  const [organizationSlug, setOrganizationSlug] = useState("");
  const [projectId, setProjectId] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const connect = trpc.integrations.connect.useMutation({
    onSuccess: (res) => {
      toast({
        title: res.status === "active" ? "Plane connected" : "Saved with warnings",
        description: res.lastError ?? "Connection verified.",
        variant: res.status === "active" ? "default" : "destructive",
      });
      void utils.integrations.list.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast({ title: "Couldn't connect", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Plane</DialogTitle>
          <DialogDescription>
            Mirror this team&apos;s tasks into a Plane project.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          <Field label="Display name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Team">
            <Select value={teamId ?? undefined} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {(teams ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Base URL (self-hosted or cloud)">
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          </Field>
          <Field label="Workspace slug">
            <Input value={organizationSlug} onChange={(e) => setOrganizationSlug(e.target.value)} />
          </Field>
          <Field label="Project ID">
            <Input value={projectId} onChange={(e) => setProjectId(e.target.value)} />
          </Field>
          <Field label="API token">
            <Input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} />
          </Field>
          <Field label="Webhook secret">
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={connect.isPending || !teamId || !organizationSlug || !projectId || !apiToken}
            onClick={() =>
              connect.mutate({
                provider: "plane",
                name,
                teamId: teamId ?? undefined,
                baseUrl: baseUrl || undefined,
                config: { organizationSlug, projectId },
                secrets: { apiToken, webhookSecret },
              })
            }
          >
            {connect.isPending ? "Connecting…" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConnectTrelloDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const { data: teams } = trpc.requests.agencyTeams.useQuery(undefined, { enabled: open });

  const [name, setName] = useState("Trello — Product & Tech");
  const [teamId, setTeamId] = useState<string | null>(null);
  const [listId, setListId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiToken, setApiToken] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");

  const connect = trpc.integrations.connect.useMutation({
    onSuccess: (res) => {
      toast({
        title: res.status === "active" ? "Trello connected" : "Saved with warnings",
        description: res.lastError ?? "Connection verified.",
        variant: res.status === "active" ? "default" : "destructive",
      });
      void utils.integrations.list.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast({ title: "Couldn't connect", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect Trello</DialogTitle>
          <DialogDescription>
            Mirror this team&apos;s tasks into a Trello list as cards.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          <Field label="Display name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Team">
            <Select value={teamId ?? undefined} onValueChange={setTeamId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {(teams ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="List ID (cards are created here)">
            <Input value={listId} onChange={(e) => setListId(e.target.value)} />
          </Field>
          <Field label="API key">
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
          </Field>
          <Field label="API token">
            <Input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} />
          </Field>
          <Field label="Webhook secret (optional)">
            <Input
              type="password"
              value={webhookSecret}
              onChange={(e) => setWebhookSecret(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={connect.isPending || !teamId || !listId || !apiKey || !apiToken}
            onClick={() =>
              connect.mutate({
                provider: "trello",
                name,
                teamId: teamId ?? undefined,
                config: { listId },
                secrets: { apiKey, apiToken, webhookSecret },
              })
            }
          >
            {connect.isPending ? "Connecting…" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export default function IntegrationsPage() {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [connecting, setConnecting] = useState(false);
  const [connectingTrello, setConnectingTrello] = useState(false);
  const { data: integrations, isLoading } = trpc.integrations.list.useQuery();

  const test = trpc.integrations.test.useMutation({
    onSuccess: (res) => {
      toast({
        title: res.ok ? "Connection healthy" : "Connection failed",
        description: res.ok ? undefined : res.error,
        variant: res.ok ? "default" : "destructive",
      });
      void utils.integrations.list.invalidate();
    },
  });
  const disconnect = trpc.integrations.disconnect.useMutation({
    onSuccess: () => {
      toast({ title: "Integration disconnected" });
      void utils.integrations.list.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Connect external project tools. Plane and Trello are available today."
        actions={
          <div className="flex gap-2">
            <Button onClick={() => setConnecting(true)}>
              <Plug className="mr-2 h-4 w-4" />
              Connect Plane
            </Button>
            <Button variant="outline" onClick={() => setConnectingTrello(true)}>
              <Plug className="mr-2 h-4 w-4" />
              Connect Trello
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading integrations…</p>
      ) : !integrations || integrations.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No integrations yet"
          description="Connect Plane so tasks created here mirror into your team's execution tool."
          action={<Button onClick={() => setConnecting(true)}>Connect Plane</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {integrations.map((i) => (
            <Card key={i.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="capitalize">{i.provider}</CardTitle>
                  <Badge variant={STATUS_VARIANT[i.status] ?? "neutral"}>
                    {humanize(i.status)}
                  </Badge>
                </div>
                <CardDescription>{i.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {i.team?.name ?? "Agency-wide"} · {i._count.links} linked tasks
                </p>
                {i.lastSyncedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last synced {formatRelative(i.lastSyncedAt)}
                  </p>
                )}
                {i.lastError && <p className="text-xs text-destructive">{i.lastError}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={test.isPending}
                    onClick={() => test.mutate({ id: i.id })}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Test
                  </Button>
                  {i.status !== "disconnected" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={disconnect.isPending}
                      onClick={() => disconnect.mutate({ id: i.id })}
                    >
                      Disconnect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="pt-8 border-t space-y-4">
        <h3 className="text-lg font-medium">Available Providers</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="opacity-50 border-dashed">
            <CardHeader>
              <CardTitle>Linear</CardTitle>
              <CardDescription>Issue tracking built for speed</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" size="sm" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
          
          <Card className="opacity-50 border-dashed">
            <CardHeader>
              <CardTitle>Jira</CardTitle>
              <CardDescription>Software development tool</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="secondary" size="sm" disabled>Coming Soon</Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <ConnectPlaneDialog open={connecting} onOpenChange={setConnecting} />
      <ConnectTrelloDialog open={connectingTrello} onOpenChange={setConnectingTrello} />
    </div>
  );
}
