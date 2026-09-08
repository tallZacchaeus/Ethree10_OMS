"use client";

import { Check, ChevronsUpDown, UserPlus } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/format";

/**
 * Picks an assignee, showing each candidate's open-task load and top skills.
 *
 * A department narrows the list; it is not required. This used to refuse to
 * open at all without one — "Select a sub-unit first" — while the rule behind
 * assignment only ever asked for membership of the project's branch. So anyone
 * attached to a branch but not a department could be assigned by the server and
 * never offered by the interface, which is what made assignment feel broken.
 */
export function AssigneePicker({
  subUnitId,
  projectId,
  value,
  onChange,
}: {
  subUnitId: string | null | undefined;
  /** Falls back to the project's branch when no department is chosen. */
  projectId?: string | null;
  value: string | null | undefined;
  onChange: (userId: string) => void;
}) {
  const { data: candidates, isLoading } = trpc.tasks.candidates.useQuery(
    { subUnitId: subUnitId ?? null, projectId: projectId ?? null },
    { enabled: Boolean(subUnitId || projectId) },
  );

  const selected = candidates?.find((c) => c.id === value);

  if (!subUnitId && !projectId) {
    return (
      <Button variant="outline" className="w-full justify-start" disabled>
        <UserPlus className="h-4 w-4" />
        Choose a project first
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
          <div className="space-y-1 p-3 text-sm">
            <p className="font-medium">Nobody can be assigned this yet.</p>
            <p className="text-muted-foreground">
              Work can only go to someone with an accepted membership of the branch that owns this
              project. {subUnitId ? "Try clearing the department to see the whole branch, or add" : "Add"}{" "}
              people to the branch under People.
            </p>
          </div>
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
