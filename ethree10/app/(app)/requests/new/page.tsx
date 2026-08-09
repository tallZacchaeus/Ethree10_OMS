"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

export default function NewRequestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [organizationId, setOrganizationId] = useState("");
  const { data: organizations = [] } = trpc.organizations.listOrganizations.useQuery();

  const createRequest = trpc.requests.create.useMutation({
    onSuccess: (data) => {
      toast({
        title: "Request submitted",
        description: `Request ${data.code} created successfully.`,
      });
      router.push(`/requests/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!organizationId) {
      toast({ title: "Select an organization", description: "Every request belongs to a client organization.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);

    // Parse deadline
    const deadlineStr = formData.get("deadline") as string;
    const deadline = deadlineStr ? new Date(deadlineStr) : undefined;

    // Parse budget
    const budgetStr = formData.get("budgetEstimate") as string;
    const budgetEstimate = budgetStr ? parseFloat(budgetStr) : undefined;

    createRequest.mutate({
      organizationId,
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      // Classified at triage, not at submission — same rule as the public form.
      projectType: "",
      urgency: "medium",
      primaryContact: formData.get("primaryContact") as string,
      deadline,
      budgetEstimate,
      expectedDeliverables: formData.get("expectedDeliverables") as string,
      supportingLinks: String(formData.get("supportingLinks") || "").split(/\s+/).filter(Boolean),
      consentToEmail: false,
    });
  };

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">New Project Request</h1>
        <p className="text-muted-foreground mt-2">
          Submit a new project request. Provide as much detail as possible to help us scope the work.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="space-y-4 bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold">Core Details</h2>
          <div className="space-y-2"><Label>Requesting organization *</Label><Select value={organizationId} onValueChange={setOrganizationId}><SelectTrigger><SelectValue placeholder="Select organization" /></SelectTrigger><SelectContent>{organizations.map((organization) => <SelectItem key={organization.id} value={organization.id}>{organization.name}</SelectItem>)}</SelectContent></Select></div>
          
          <div className="space-y-2">
            <Label htmlFor="title">Project Title *</Label>
            <Input id="title" name="title" required placeholder="e.g. Easter Campaign Landing Page" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea 
              id="description" 
              name="description" 
              required 
              className="min-h-[150px]" 
              placeholder="What are the goals? Who is the audience? Any specific features needed?" 
            />
          </div>

          <div className="space-y-2"><Label htmlFor="expectedDeliverables">Expected deliverables *</Label><Textarea id="expectedDeliverables" name="expectedDeliverables" required /></div>
          <div className="space-y-2"><Label htmlFor="supportingLinks">Supporting links</Label><Textarea id="supportingLinks" name="supportingLinks" /></div>
          <p className="text-sm text-muted-foreground">
            The service, branch and urgency are set during triage in the Intake Queue.
          </p>
        </div>

        <div className="space-y-4 bg-card p-6 rounded-lg border">
          <h2 className="text-xl font-semibold">Additional Information (Optional)</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="deadline">Requested Deadline</Label>
              <Input id="deadline" name="deadline" type="date" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="primaryContact">Primary Contact</Label>
              <Input id="primaryContact" name="primaryContact" placeholder="Name or email" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budgetEstimate">Budget Estimate (NGN)</Label>
            <Input id="budgetEstimate" name="budgetEstimate" type="number" min="0" step="1000" placeholder="e.g. 500000" />
          </div>
        </div>

        <div className="flex justify-end space-x-4">
          <Button variant="outline" type="button" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Button>
        </div>
      </form>
    </div>
  );
}
