"use client";

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { trpc } from "@/lib/trpc/client";

// NEXT_PUBLIC_* is inlined at build time, so this is the value the running
// bundle actually has — not a guess about the server's environment.
const posthogConfigured = Boolean(process.env["NEXT_PUBLIC_POSTHOG_KEY"]);

export default function AnalyticsPage() {
  const { data: advancedMetrics, isLoading } = trpc.analytics.getAdvancedMetrics.useQuery();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Advanced metrics, agency throughput, and bottleneck detection.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>6-Month Throughput</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={advancedMetrics?.throughput}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="completed" stroke="#8884d8" name="Tasks Completed" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Bottleneck Detection</CardTitle>
            <p className="text-xs text-muted-foreground">Average days spent in transition stages</p>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">Loading...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={advancedMetrics?.bottlenecks} layout="vertical" margin={{ left: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={100} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="avgDays" fill="#ef4444" name="Avg Days" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>PostHog Integration</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Read the config rather than asserting. This panel used to state
              events were being sent while no key was configured in production
              and the build logged "product analytics disabled" — a screen that
              tells an operator a thing is working when it is not is worse than
              no screen. */}
          {posthogConfigured ? (
            <p className="text-sm text-muted-foreground mb-4">
              Events are being sent to PostHog. For funnel analysis, session recordings and cohort
              tracking, open the full dashboard there.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium text-amber-700 dark:text-amber-500">
                Not connected.
              </span>{" "}
              No PostHog key is configured, so no events are being sent and nothing below reaches
              PostHog. Set <code className="font-mono text-xs">NEXT_PUBLIC_POSTHOG_KEY</code> to
              enable it. The charts on this page come from the application database and are
              unaffected.
            </p>
          )}
          <a 
            href="https://app.posthog.com" 
            target="_blank" 
            rel="noreferrer"
            className="text-primary hover:underline text-sm font-medium"
          >
            Open PostHog Console &rarr;
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
