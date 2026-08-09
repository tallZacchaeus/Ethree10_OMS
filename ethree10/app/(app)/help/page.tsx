"use client";

import { useState } from "react";
import { useAgencyContext } from "@/components/providers/agency-provider";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ROLE_GUIDES, UNIVERSAL_RULES, LIFECYCLE, type HelpStep } from "@/lib/help-content";
import { Check, X, ArrowRight, BookOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";

function StepCard({ step, index }: { step: HelpStep; index: number }) {
  return (
    <div className="relative rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
          {index + 1}
        </span>
        <div className="min-w-0 space-y-2">
          <p className="font-medium">{step.title}</p>
          <p className="text-sm text-muted-foreground">{step.detail}</p>

          {step.requires && step.requires.length > 0 && (
            <div className="rounded-md bg-amber-50 p-3 dark:bg-amber-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Only works if
              </p>
              <ul className="mt-1 space-y-0.5">
                {step.requires.map((item) => (
                  <li key={item} className="text-sm text-amber-900 dark:text-amber-200">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step.then && step.then.length > 0 && (
            <div className="rounded-md bg-emerald-50 p-3 dark:bg-emerald-950/40">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                What happens next
              </p>
              <ul className="mt-1 space-y-0.5">
                {step.then.map((item) => (
                  <li key={item} className="text-sm text-emerald-900 dark:text-emerald-200">
                    · {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The handbook. Opens on the reader's own role, but every role is readable —
 * knowing what the person you are waiting on can and cannot do is usually the
 * fastest way to unblock yourself.
 */
export default function HelpPage() {
  const { roles, isSuperAdmin } = useAgencyContext();

  const myRole = isSuperAdmin ? "super_admin" : roles[0];
  const [selected, setSelected] = useState<string | null>(null);
  const activeRole = selected ?? myRole ?? "team_member";
  const guide = ROLE_GUIDES.find((entry) => entry.role === activeRole) ?? ROLE_GUIDES[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title="How to use E310"
        description="What you can do, what has to be true first, and what happens next — for every role."
      />

      {/* Role switcher */}
      <div className="flex flex-wrap gap-2">
        {ROLE_GUIDES.map((entry) => {
          const isMine = entry.role === myRole;
          const isActive = entry.role === activeRole;
          return (
            <Button
              key={entry.role}
              size="sm"
              variant={isActive ? "default" : "outline"}
              onClick={() => setSelected(entry.role)}
            >
              {entry.label}
              {isMine && (
                <span className={cn("ml-2 text-[10px] uppercase tracking-wide", isActive ? "opacity-80" : "text-muted-foreground")}>
                  you
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {guide && (
        <>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-3">
                <CardTitle className="text-2xl">{guide.label}</CardTitle>
                {guide.role === myRole && <Badge variant="success">Your role</Badge>}
              </div>
              <CardDescription className="text-base">{guide.tagline}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-relaxed">{guide.summary}</p>
              <p className="text-sm">
                <span className="font-medium">Start your day at:</span>{" "}
                <span className="text-muted-foreground">{guide.home}</span>
              </p>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">You can</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {guide.can.map((item) => (
                    <li key={item} className="flex gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">You cannot</CardTitle>
                <CardDescription>Deliberate, not missing. Each has a reason.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {guide.cannot.map((item) => (
                    <li key={item} className="flex gap-2 text-sm">
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          {guide.sections.map((section) => (
            <Card key={section.heading}>
              <CardHeader>
                <CardTitle className="text-lg">{section.heading}</CardTitle>
                {section.body && <CardDescription className="text-sm leading-relaxed">{section.body}</CardDescription>}
              </CardHeader>
              {section.steps && section.steps.length > 0 && (
                <CardContent className="space-y-3">
                  {section.steps.map((step, index) => (
                    <StepCard key={step.title} step={step} index={index} />
                  ))}
                </CardContent>
              )}
            </Card>
          ))}
        </>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">The full journey, request to receipt</CardTitle>
          </div>
          <CardDescription>
            Every piece of work follows these ten steps. Each shows what must already be true, and
            what the system does once the step completes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {LIFECYCLE.map((step, index) => (
            <StepCard key={step.title} step={step} index={index} />
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Rules that apply to everyone</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {UNIVERSAL_RULES.map((rule) => (
            <div key={rule.heading}>
              <p className="font-medium">{rule.heading}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{rule.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
