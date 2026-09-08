"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { captureCriticalFailure } from "@/lib/observability";

/**
 * Catches a render or data-loading failure anywhere in the signed-in app.
 *
 * Before this existed the whole route group had no boundary, so one thrown
 * error in one panel replaced the entire page with Next's default screen —
 * which in production shows nothing useful and offers no way back. Here the
 * sidebar and topbar survive, because the boundary sits inside the layout, so
 * the reader can still navigate away from a broken page.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureCriticalFailure("app-route-error", error, { digest: error.digest });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg border-amber-300 dark:border-amber-900/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" aria-hidden="true" />
            <CardTitle className="text-lg">This page didn&apos;t load</CardTitle>
          </div>
          <CardDescription>
            Something went wrong fetching or rendering it. The failure has been reported. Your
            work has not been lost — nothing was saved or changed by this error.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Reference for support: <code className="font-mono">{error.digest}</code>
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={reset}>Try again</Button>
            <Button asChild variant="outline">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
