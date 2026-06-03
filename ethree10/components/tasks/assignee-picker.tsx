"use client";

import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

/**
 * Picks an assignee from a sub-unit's members, surfacing each candidate's
 * current open-task load and top skills to support smart routing.
 */
export function AssigneePicker({
  subUnitId,
  value,
  onChange,
}: {
  subUnitId: string | null | undefined;
  value: string | null | undefined;
  onChange: (userId: string) => void;
}) {
  const { data: candidates, isLoading } = trpc.tasks.candidates.useQuery(
    { subUnitId: subUnitId ?? "" },
    { enabled: Boolean(subUnitId) },
  );

  const selected = candidates?.find((c) => c.id === value);

  if (!subUnitId) {
    return (
      <Button variant="outline" className="w-full justify-start" disabled>
        <UserPlus className="h-4 w-4" />
        Select a sub-unit first
      </Button>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="flex items-center gap-2 truncate">
            <UserPlus className="h-4 w-4 text-muted-foreground" />
            {selected ? selected.name : "Assign to…"}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-1" align="start">
        {isLoading ? (
          <p className="p-3 text-sm text-muted-foreground">Loading candidates…</p>
        ) : !candidates || candidates.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">
            No members in this sub-unit yet.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto">
            {candidates.map((c) => (
              <li key={c.id}>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onChange(c.id)}
                  className="h-auto w-full justify-start gap-3 rounded-md p-2 text-left hover:bg-accent"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{initials(c.name)}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{c.name}</span>
                      {value === c.id && <Check className="h-3.5 w-3.5 text-brand-600" />}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.openTaskCount} open · {c.estimatedHoursRemaining}h est.
                      {c.skills.length > 0 ? ` · ${c.skills.slice(0, 3).join(", ")}` : ""}
                    </span>
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
