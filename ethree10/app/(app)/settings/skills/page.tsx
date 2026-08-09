"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { useAgencyContext } from "@/components/providers/agency-provider";
import { PageHeader } from "@/components/ui-ext/page-header";
import { EmptyState } from "@/components/ui-ext/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useToast } from "@/components/ui/use-toast";

interface SkillRow {
  id: string;
  name: string;
  category: string | null;
  peopleCount: number;
}

export default function SkillsSettingsPage() {
  const { roles, isSuperAdmin } = useAgencyContext();
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const canManage = isSuperAdmin || roles.some((r: string) => r === "agency_admin");

  const { data: skills = [], isLoading } = trpc.skills.list.useQuery(undefined, { retry: false });

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [editing, setEditing] = useState<SkillRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [removing, setRemoving] = useState<SkillRow | null>(null);

  const onError = (e: { message: string }) =>
    toast({ title: "Could not save", description: e.message, variant: "destructive" });

  const create = trpc.skills.create.useMutation({
    onSuccess: () => {
      toast({ title: "Skill added" });
      void utils.skills.list.invalidate();
      setName("");
      setCategory("");
    },
    onError,
  });

  const update = trpc.skills.update.useMutation({
    onSuccess: () => {
      toast({ title: "Skill updated" });
      void utils.skills.list.invalidate();
      setEditing(null);
    },
    onError,
  });

  const remove = trpc.skills.remove.useMutation({
    onSuccess: (result) => {
      toast({
        title: "Skill deleted",
        description: result.removedFrom
          ? `Removed from ${result.removedFrom} ${result.removedFrom === 1 ? "profile" : "profiles"}.`
          : undefined,
      });
      void utils.skills.list.invalidate();
      void utils.members.list.invalidate();
      setRemoving(null);
    },
    onError: (e) => toast({ title: "Could not delete", description: e.message, variant: "destructive" }),
  });

  // Group by category so a long list stays readable.
  const grouped = skills.reduce<Record<string, SkillRow[]>>((acc, skill) => {
    const key = skill.category?.trim() || "Uncategorised";
    (acc[key] ??= []).push(skill);
    return acc;
  }, {});

  function openEdit(skill: SkillRow) {
    setEditing(skill);
    setEditName(skill.name);
    setEditCategory(skill.category ?? "");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Skills"
        description="The shared vocabulary for what people can do. Used when suggesting who should take a task."
      />

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Add a skill</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim().length >= 2) {
                  create.mutate({ name: name.trim(), category: category.trim() || undefined });
                }
              }}
            >
              <div className="flex-1 space-y-2">
                <Label htmlFor="skill-name">Name</Label>
                <Input
                  id="skill-name"
                  placeholder="e.g. Motion design"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="skill-category">Category (optional)</Label>
                <Input
                  id="skill-category"
                  placeholder="e.g. Design"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={create.isPending || name.trim().length < 2}>
                {create.isPending ? "Adding…" : "Add skill"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading skills…</p>
      ) : skills.length === 0 ? (
        <EmptyState
          title="No skills yet"
          description="Add the skills your people actually have, then record them on each profile."
        />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([groupName, rows]) => (
              <Card key={groupName}>
                <CardHeader>
                  <CardTitle className="text-base">{groupName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y rounded-md border">
                    {rows.map((skill) => (
                      <li key={skill.id} className="flex items-center justify-between gap-2 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{skill.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {skill.peopleCount === 0
                              ? "Nobody has this yet"
                              : `${skill.peopleCount} ${skill.peopleCount === 1 ? "person" : "people"}`}
                          </p>
                        </div>
                        {canManage ? (
                          <div className="flex shrink-0 gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Edit ${skill.name}`}
                              onClick={() => openEdit(skill)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Delete ${skill.name}`}
                              onClick={() => setRemoving(skill)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Badge variant="neutral">{skill.peopleCount}</Badge>
                        )}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
        </div>
      )}

      <Dialog open={Boolean(editing)} onOpenChange={(next) => !next && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit skill</DialogTitle>
            <DialogDescription>
              Renaming keeps it on everyone who already has it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-skill-name">Name</Label>
              <Input
                id="edit-skill-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-skill-category">Category</Label>
              <Input
                id="edit-skill-category"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button
              disabled={update.isPending || editName.trim().length < 2}
              onClick={() =>
                editing &&
                update.mutate({
                  id: editing.id,
                  name: editName.trim(),
                  category: editCategory.trim() || null,
                })
              }
            >
              {update.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(removing)} onOpenChange={(next) => !next && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {removing?.name}?</DialogTitle>
            <DialogDescription>
              {removing && removing.peopleCount > 0 ? (
                <>
                  It is recorded against{" "}
                  <strong>
                    {removing.peopleCount} {removing.peopleCount === 1 ? "person" : "people"}
                  </strong>
                  . Deleting removes it from their profiles and from assignment suggestions. This
                  cannot be undone.
                </>
              ) : (
                "Nobody has this skill, so nothing else changes."
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => removing && remove.mutate({ id: removing.id, force: true })}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
