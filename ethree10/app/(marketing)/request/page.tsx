"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Copy } from "lucide-react";

export default function PublicRequestPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState<{ code: string; trackingUrl: string } | null>(null);

  const submit = trpc.requests.publicSubmit.useMutation({
    onSuccess: (data) => {
      const trackingUrl = `${window.location.origin}/track/${data.publicToken}`;
      setDone({ code: data.code, trackingUrl });
    },
    onError: (error) => {
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setIsSubmitting(true);
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const deadlineStr = fd.get("deadline") as string;
    const budgetStr = fd.get("budgetEstimate") as string;
    const supportingLinks = String(fd.get("supportingLinks") ?? "")
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);

    // No service, urgency, outcome or acceptance criteria here by design. The
    // requester says what they need in their own words; staff classify the
    // service, set urgency and agree the scope during triage.
    submit.mutate({
      requesterName: fd.get("requesterName") as string,
      requesterEmail: fd.get("requesterEmail") as string,
      requesterPhone: (fd.get("requesterPhone") as string) || undefined,
      organizationName: fd.get("organizationName") as string,
      title: fd.get("title") as string,
      description: fd.get("description") as string,
      deadline: new Date(deadlineStr),
      budgetEstimate: budgetStr ? parseFloat(budgetStr) : undefined,
      expectedDeliverables: fd.get("expectedDeliverables") as string,
      supportingLinks,
      consentToEmail: true,
    });
  };

  if (done) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-16">
        <Card>
          <CardHeader className="items-center text-center">
            <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <CardTitle className="text-2xl">Request submitted</CardTitle>
            <CardDescription>
              Your request <span className="font-medium text-foreground">{done.code}</span> is in.
              Save the link below to track its progress — no account needed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <span className="min-w-0 flex-1 truncate text-sm">{done.trackingUrl}</span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(done.trackingUrl);
                  toast({ title: "Link copied" });
                }}
              >
                <Copy className="h-4 w-4" />
                Copy
              </Button>
            </div>
            <Button asChild className="w-full">
              <a href={done.trackingUrl}>Track my request</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-2xl px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl font-bold">Start a Project</CardTitle>
          <CardDescription>
            Tell us what you need. We&apos;ll review it and send you a private link to track progress —
            no sign-up required.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="requesterName">Your Name *</Label>
                <Input id="requesterName" name="requesterName" required placeholder="Jane Doe" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requesterEmail">Email *</Label>
                <Input id="requesterEmail" name="requesterEmail" type="email" required placeholder="jane@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="organizationName">Organization *</Label>
                <Input id="organizationName" name="organizationName" required placeholder="Your ministry or NGO" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requesterPhone">Phone</Label>
                <Input id="requesterPhone" name="requesterPhone" type="tel" placeholder="+234… (optional)" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input id="title" name="title" required placeholder="e.g. Easter Campaign Landing Page" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">What do you need? *</Label>
              <Textarea
                id="description"
                name="description"
                required
                className="min-h-[150px]"
                placeholder="Describe it in your own words — goals, audience, and anything specific you have in mind. Our team will work out the details with you."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedDeliverables">Expected deliverables *</Label>
              <Textarea id="expectedDeliverables" name="expectedDeliverables" required placeholder="List the files, links, campaign assets, product features, or other outputs you expect." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supportingLinks">Supporting links</Label>
              <Textarea id="supportingLinks" name="supportingLinks" placeholder="Optional — links to briefs, brand assets, references, or existing systems (one per line)." />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deadline">Requested Deadline *</Label>
                <Input id="deadline" name="deadline" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budgetEstimate">Budget Estimate (NGN)</Label>
                <Input id="budgetEstimate" name="budgetEstimate" type="number" min="0" step="1000" placeholder="Optional — e.g. 500000" />
              </div>
            </div>

            <label className="flex items-start gap-3 rounded-md border p-4 text-sm">
              <input name="consentToEmail" type="checkbox" required className="mt-1" />
              <span>I agree to receive request-status, clarification, and delivery emails for this request. *</span>
            </label>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Request"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
