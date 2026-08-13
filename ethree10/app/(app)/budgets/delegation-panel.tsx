"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useAgencyContext } from "@/components/providers/agency-provider";
import { ShieldCheck, Clock } from "lucide-react";

/** 90 days, mirroring MAX_DELEGATION_DAYS. The server refuses anything longer. */
const MAX_DAYS = 90;

function daysUntil(date: Date | string): number {
  const end = typeof date === "string" ? new Date(date) : date;
  return Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function defaultExpiry(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

/**
 * Budget approval delegation.
 *
 * Deliberately prominent rather than tucked into settings: a live delegation is
 * a standing exception to the agency's tightest control, and the plan makes its
 * visibility load-bearing rather than optional — a 90-day grant can otherwise
 * outlive the absence that justified it without anyone noticing.
 */
export function DelegationPanel() {
  const { toast } = useToast();
  const { roles, isSuperAdmin, userId } = useAgencyContext();
  const utils = trpc.useUtils();

  const canDelegate = isSuperAdmin || roles.includes("chief_executive");

  const active = trpc.budgets.activeDelegations.useQuery();
  const [delegateId, setDelegateId] = useState("");
  const [reason, setReason] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiry);

  const members = trpc.members.list.useQuery(undefined, { enabled: canDelegate });

  const grant = trpc.budgets.grantDelegation.useMutation({
    onSuccess: () => {
      void utils.budgets.activeDelegations.invalidate();
      setReason("");
      setDelegateId("");
      toast({ title: "Approval delegated" });
    },
    onError: (error) =>
      toast({ title: "Could not delegate", description: error.message, variant: "destructive" }),
  });

  const revoke = trpc.budgets.revokeDelegation.useMutation({
    onSuccess: () => {
      void utils.budgets.activeDelegations.invalidate();
      toast({ title: "Delegation revoked" });
    },
    onError: (error) =>
      toast({ title: "Could not revoke", description: error.message, variant: "destructive" }),
  });

  const current = active.data?.[0] ?? null;
  const iHoldIt = Boolean(current && current.delegateId === userId);

  // Anyone who can reach this page but cannot delegate is here *because* of a
  // delegation, so tell them plainly rather than showing an empty panel.
  if (!canDelegate) {
    if (!iHoldIt) return null;
    return (
      <Card className="border-brand-300 dark:border-brand-800">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
            <CardTitle className="text-lg">You are approving budgets on delegation</CardTitle>
          </div>
          <CardDescription>
            Granted by {current?.grantedBy?.name ?? "the Chief Executive"} — expires{" "}
            {new Date(current!.expiresAt).toDateString()} ({daysUntil(current!.expiresAt)} days left).
            Reason: {current!.reason}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            You still cannot confirm a payment against a budget you approve — that stays with
            Finance, so approving and paying are never the same person.
          </p>
        </CardContent>
      </Card>
    );
  }

  const assignable = (members.data ?? []).filter(
    (m: { user: { id: string } }) => m.user.id !== userId,
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Approval delegation</CardTitle>
        </div>
        <CardDescription>
          Hand budget approval to someone else while you are away. One person at a time, for at
          most {MAX_DAYS} days, and every approval they make is recorded as delegated.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {current ? (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/30">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">Active</Badge>
                <span className="font-medium">{current.delegate?.name}</span>
                {daysUntil(current.expiresAt) <= 7 && (
                  <Badge variant="destructive" className="gap-1">
                    <Clock className="h-3 w-3" />
                    Expires in {daysUntil(current.expiresAt)} days
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Can approve budgets until {new Date(current.expiresAt).toDateString()} — {current.reason}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              disabled={revoke.isPending}
              onClick={() => revoke.mutate({ delegationId: current.id })}
            >
              Revoke now
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nobody currently holds delegated approval. You are the only person who can approve a
            budget.
          </p>
        )}

        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            grant.mutate({ delegateId, reason, expiresAt: new Date(expiresAt) });
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="delegate">Delegate to</Label>
            <Select value={delegateId} onValueChange={setDelegateId}>
              <SelectTrigger id="delegate">
                <SelectValue placeholder="Choose a person" />
              </SelectTrigger>
              <SelectContent>
                {assignable.map((m: { user: { id: string; name: string }; role: string }) => (
                  <SelectItem key={m.user.id} value={m.user.id}>
                    {m.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires">Until</Label>
            <Input
              id="expires"
              type="date"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="reason">Why</Label>
            <Input
              id="reason"
              placeholder="e.g. Annual leave, 14–28 August"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          <div className="sm:col-span-2">
            <Button
              type="submit"
              disabled={grant.isPending || !delegateId || reason.trim().length < 3}
            >
              {current ? "Replace delegation" : "Delegate approval"}
            </Button>
            {current && (
              <p className="mt-2 text-xs text-muted-foreground">
                Granting a new delegation revokes the current one.
              </p>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
