"use client";

import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Plus } from "lucide-react";
import { useState } from "react";
import { ScorecardEditorDialog } from "@/components/scorecards/scorecard-editor-dialog";

export default function ScorecardsPage() {
  const { activeWorkspace: currentWorkspace } = useWorkspace();
  const [editingScorecardId, setEditingScorecardId] = useState<string | null>(null);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);

  const { data: scorecards, isLoading } = trpc.scorecards.list.useQuery(
    { workspaceId: currentWorkspace?.id ?? "" },
    { enabled: !!currentWorkspace?.id }
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">KPI Scorecards</h1>
          <p className="text-muted-foreground mt-1">
            Configure scorecards for departments and sub-units.
          </p>
        </div>
        <Button onClick={() => setIsCreatorOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Scorecard
        </Button>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {scorecards?.map((scorecard) => (
            <Card key={scorecard.id} className="hover:border-primary cursor-pointer" onClick={() => setEditingScorecardId(scorecard.id)}>
              <CardHeader>
                <CardTitle className="text-lg">{scorecard.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  <p>Level: <span className="capitalize">{scorecard.level}</span></p>
                  <p>Items: {(scorecard.items as unknown[])?.length || 0}</p>
                </div>
              </CardContent>
            </Card>
          ))}
          {scorecards?.length === 0 && (
            <div className="col-span-2 text-center p-12 border border-dashed rounded-lg">
              <p className="text-muted-foreground">No scorecards found.</p>
            </div>
          )}
        </div>
      )}

      {isCreatorOpen && (
        <ScorecardEditorDialog
          isOpen={isCreatorOpen}
          onClose={() => setIsCreatorOpen(false)}
          workspaceId={currentWorkspace?.id ?? ""}
        />
      )}
      
      {editingScorecardId && (
        <ScorecardEditorDialog
          isOpen={!!editingScorecardId}
          onClose={() => setEditingScorecardId(null)}
          workspaceId={currentWorkspace?.id ?? ""}
          scorecardId={editingScorecardId}
        />
      )}
    </div>
  );
}
