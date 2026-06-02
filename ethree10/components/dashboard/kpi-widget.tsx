"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type KpiSnapshot } from "@prisma/client";

type KpiItem = { score: number; weight: number; target: number | string; actual: number | string };

export function KpiWidget({ snapshot }: { snapshot: KpiSnapshot | null }) {
  if (!snapshot) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Department KPI Scorecard</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No scorecard available for this period.</p>
        </CardContent>
      </Card>
    );
  }

  const scorecards = snapshot.scorecard as Record<string, KpiItem>;

  return (
    <Card>
      <CardHeader className="pb-2 border-b mb-4">
        <div className="flex justify-between items-center">
          <CardTitle>KPI Scorecard</CardTitle>
          <div className="text-right">
            <span className="text-2xl font-bold">{Number(snapshot.totalScore).toFixed(1)}</span>
            <span className="text-muted-foreground text-sm"> / 100</span>
          </div>
        </div>
        <p className="text-sm font-medium text-primary">{snapshot.rating}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(scorecards).map(([key, item]) => (
          <div key={key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
              <span>{item.score} / {item.weight}</span>
            </div>
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary" 
                style={{ width: `${Math.min(100, (item.score / item.weight) * 100)}%` }}
              />
            </div>
            <div className="text-xs text-muted-foreground">
              Target: {item.target} | Actual: {item.actual}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
