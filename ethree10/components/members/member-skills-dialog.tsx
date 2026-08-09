"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { SkillLevel } from "@prisma/client";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";

const LEVELS: SkillLevel[] = ["beginner", "intermediate", "advanced", "expert"];

interface Selected {
  skillId: string;
  level: SkillLevel;
}

/**
 * Records what one person can do. This is not a profile decoration — the task
 * assignee suggester in `server/services/task.ts` ranks candidates on these, so
 * an empty skill set means that person is never suggested for anything.
 */
export function MemberSkillsDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: {
  userId: string | null;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const utils = trpc.useUtils();
  const [selected, setSelected] = useState<Selected[]>([]);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [adding, setAdding] = useState("");

  const { data: catalogue = [] } = trpc.skills.list.useQuery(undefined, { enabled: open });
  const { data: current, isLoading } = trpc.skills.forUser.useQuery(
    { userId: userId ?? "" },
    { enabled: open && Boolean(userId) },
  );

  // Seed the editor from the server once per person, without an effect.
  if (open && userId && current && loadedFor !== userId) {
    setLoadedFor(userId);
    setSelected(current.map((s) => ({ skillId: s.skillId, level: s.level })));
  }

  const save = trpc.skills.setForUser.useMutation({
    onSuccess: () => {
      toast({ title: "Skills updated" });
      void utils.skills.forUser.invalidate();
      void utils.skills.list.invalidate();
      void utils.members.list.invalidate();
      setLoadedFor(null);
      onOpenChange(false);
    },
    onError: (e) =>
      toast({ title: "Could not save skills", description: e.message, variant: "destructive" }),
  });

  const nameOf = (skillId: string) =>
    catalogue.find((skill) => skill.id === skillId)?.name ?? "Unknown skill";
  const unselected = catalogue.filter(
    (skill) => !selected.some((s) => s.skillId === skill.id),
  );

  function close(next: boolean) {
    if (!next) setLoadedFor(null);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skills — {userName}</DialogTitle>
          <DialogDescription>
            Used when suggesting who should pick up a task. Keep it to what they can actually be
            given work in.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            {selected.length === 0 ? (
              <p className="text-sm text-muted-foreground">No skills recorded yet.</p>
            ) : (
              <ul className="space-y-2">
                {selected.map((entry) => (
                  <li key={entry.skillId} className="flex items-center gap-2">
                    <Badge variant="neutral" className="flex-1 justify-start truncate">
                      {nameOf(entry.skillId)}
                    </Badge>
                    <Select
                      value={entry.level}
                      onValueChange={(level) =>
                        setSelected((rows) =>
                          rows.map((row) =>
                            row.skillId === entry.skillId
                              ? { ...row, level: level as SkillLevel }
                              : row,
                          ),
                        )
                      }
                    >
                      <SelectTrigger className="h-8 w-36" aria-label={`Level for ${nameOf(entry.skillId)}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEVELS.map((level) => (
                          <SelectItem key={level} value={level} className="capitalize">
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Remove ${nameOf(entry.skillId)}`}
                      onClick={() =>
                        setSelected((rows) => rows.filter((row) => row.skillId !== entry.skillId))
                      }
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2">
              <Label htmlFor="add-skill">Add a skill</Label>
              {catalogue.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No skills exist yet.{" "}
                  <Link href="/settings/skills" className="underline">
                    Create some first
                  </Link>
                  .
                </p>
              ) : unselected.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every skill is already listed.</p>
              ) : (
                <Select
                  value={adding}
                  onValueChange={(skillId) => {
                    setSelected((rows) => [...rows, { skillId, level: "intermediate" }]);
                    setAdding("");
                  }}
                >
                  <SelectTrigger id="add-skill">
                    <SelectValue placeholder="Choose a skill" />
                  </SelectTrigger>
                  <SelectContent>
                    {unselected.map((skill) => (
                      <SelectItem key={skill.id} value={skill.id}>
                        {skill.name}
                        {skill.category ? ` · ${skill.category}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={save.isPending || !userId}
            onClick={() => userId && save.mutate({ userId, skills: selected })}
          >
            {save.isPending ? "Saving…" : "Save skills"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
