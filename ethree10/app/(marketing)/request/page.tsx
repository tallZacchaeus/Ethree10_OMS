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
  const [serviceId, setServiceId] = useState("");
  const [done, setDone] = useState<{ code: string; trackingUrl: string } | null>(null);
  const { data: services = [], isLoading: servicesLoading } = trpc.services.publicList.useQuery();
  const selectedService = services.find((service) => service.id === serviceId);

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
    e.preventDefault();
    if (!selectedService) {
      toast({ title: "Pick a service", description: "Tell us what kind of solution you need.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const deadlineStr = fd.get("deadline") as string;
    const budgetStr = fd.get("budgetEstimate") as string;
    const supportingLinks = String(fd.get("supportingLinks") ?? "")
      .split(/\s+/)
      .map((value) => value.trim())
      .filter(Boolean);

    submit.mutate({
      requesterName: fd.get("requesterName") as string,
      requesterEmail: fd.get("requesterEmail") as string,
      requesterPhone: (fd.get("requesterPhone") as string) || undefined,
      organizationName: (fd.get("organizationName") as string) || undefined,
      title: fd.get("title") as string,
      description: fd.get("description") as string,
      projectType: selectedService.slug,
      serviceId: selectedService.id,
      urgency: fd.get("urgency") as "low" | "medium" | "high" | "critical",
      deadline: deadlineStr ? new Date(deadlineStr) : undefined,
      budgetEstimate: budgetStr ? parseFloat(budgetStr) : undefined,
      expectedOutcome: fd.get("expectedOutcome") as string,
      expectedDeliverables: fd.get("expectedDeliverables") as string,
      acceptanceCriteria: fd.get("acceptanceCriteria") as string,
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
                <Label htmlFor="organizationName">Organization</Label>
                <Input id="organizationName" name="organizationName" placeholder="Your ministry or NGO" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requesterPhone">Phone</Label>
                <Input id="requesterPhone" name="requesterPhone" type="tel" placeholder="+234…" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Project Title *</Label>
              <Input id="title" name="title" required placeholder="e.g. Easter Campaign Landing Page" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="serviceId">Service *</Label>
                <Select value={serviceId} onValueChange={setServiceId} disabled={servicesLoading}>
                  <SelectTrigger>
                    <SelectValue placeholder={servicesLoading ? "Loading services…" : "Select a service"} />
                  </SelectTrigger>
                  <SelectContent>
                    {services.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name}{service.team ? ` — ${service.team.name}` : " — Agency review"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="urgency">Urgency *</Label>
                <Select name="urgency" defaultValue="medium">
                  <SelectTrigger>
                    <SelectValue placeholder="Select urgency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Project Description *</Label>
              <Textarea
                id="description"
                name="description"
                required
                className="min-h-[150px]"
                placeholder="Goals, audience, timeline, any specific requirements…"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedOutcome">Expected outcome *</Label>
              <Textarea id="expectedOutcome" name="expectedOutcome" required placeholder="What should improve or become possible when this work is complete?" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expectedDeliverables">Expected deliverables *</Label>
              <Textarea id="expectedDeliverables" name="expectedDeliverables" required placeholder="List the files, links, campaign assets, product features, or other outputs you expect." />
            </div>

            <div className="space-y-2">
              <Label htmlFor="acceptanceCriteria">Success / acceptance criteria *</Label>
              <Textarea id="acceptanceCriteria" name="acceptanceCriteria" required placeholder="How will both sides know the solution is complete and acceptable?" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="supportingLinks">Supporting links</Label>
              <Textarea id="supportingLinks" name="supportingLinks" placeholder="Paste links to briefs, brand assets, references, or existing systems (one per line)." />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="deadline">Requested Deadline</Label>
                <Input id="deadline" name="deadline" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="budgetEstimate">Budget Estimate (NGN)</Label>
                <Input id="budgetEstimate" name="budgetEstimate" type="number" min="0" step="1000" placeholder="e.g. 500000" />
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
