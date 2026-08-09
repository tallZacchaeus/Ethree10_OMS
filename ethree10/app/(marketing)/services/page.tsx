"use client";

import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { publicCategoryLabel } from "@/lib/request-types";

/**
 * Public services page.
 *
 * Grouped by **client-facing category**, never by internal branch name. Which
 * branch owns a service is our routing concern, not the client's — they pick
 * what they want done and it lands with the right team.
 */
export default function ServicesPage() {
  const { data: services = [], isLoading } = trpc.services.publicList.useQuery();

  const groups = Map.groupBy(services, (service) =>
    publicCategoryLabel(service.team?.slug),
  );

  return (
    <main className="container mx-auto space-y-10 px-4 py-14">
      <header className="mx-auto max-w-3xl text-center">
        <h1 className="text-4xl font-bold">What we can build for you</h1>
        <p className="mt-3 text-muted-foreground">
          Pick whatever is closest to what you need — you don&apos;t have to get it exactly
          right. Tell us the outcome in your own words and our team will shape the rest
          with you.
        </p>
      </header>

      {isLoading ? (
        <p className="text-center text-muted-foreground">Loading services…</p>
      ) : (
        Array.from(groups.entries()).map(([category, entries]) => (
          <section key={category} className="space-y-4">
            <h2 className="text-2xl font-semibold">{category}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {entries.map((service) => (
                <Card key={service.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {service.description ||
                        "Tell us the outcome you need and our team will scope the solution."}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {service.defaultSlaHours
                        ? `We usually respond within ${service.defaultSlaHours} hours.`
                        : "We'll confirm timing when we review your request."}
                    </p>
                    <Button asChild size="sm">
                      <Link href="/request">Start a request</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      <div className="text-center">
        <Button asChild size="lg">
          <Link href="/request">Start a project</Link>
        </Button>
        <p className="mt-2 text-sm text-muted-foreground">
          Not sure which one? Just describe what you need — we&apos;ll route it.
        </p>
      </div>
    </main>
  );
}
