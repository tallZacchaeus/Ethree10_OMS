"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function useTeamScope() {
  const { data: teams = [], isLoading } = trpc.teams.list.useQuery();
  const { data: me } = trpc.auth.me.useQuery();
  const preferred = me?.memberships.find((membership) => membership.isPrimary && membership.teamId)?.teamId
    ?? me?.memberships.find((membership) => membership.teamId)?.teamId
    ?? teams[0]?.id
    ?? "";
  const [selected, setSelected] = useState("");
  return { teams, teamId: selected || preferred, setTeamId: setSelected, isLoading };
}

export function TeamScopeSelect(props: ReturnType<typeof useTeamScope>) {
  if (props.isLoading) return <span className="text-sm text-muted-foreground">Loading teams…</span>;
  return (
    <Select value={props.teamId} onValueChange={props.setTeamId}>
      <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Select a team" /></SelectTrigger>
      <SelectContent>
        {props.teams.map((team) => <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
