"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

export default function NewRequestPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    // Parse deadline
    const deadlineStr = formData.get("deadline") as string;
    const deadline = deadlineStr ? new Date(deadlineStr) : undefined;
    
    // Parse budget
    const budgetStr = formData.get("budgetEstimate") as string;
    const budgetEstimate = budgetStr ? parseFloat(budgetStr) : undefined;

    createRequest.mutate({
      title: formData.get("title") as string,
      description: formData.get("description") as string,
      projectType: formData.get("projectType") as string,
      urgency: formData.get("urgency") as "low" | "medium" | "high" | "critical",
      primaryContact: formData.get("primaryContact") as string,
      deadline,
      budgetEstimate,
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="projectType">Project Type *</Label>
              <Select name="projectType" defaultValue="web_app">
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="web_app">Web Application</SelectItem>
                  <SelectItem value="marketing_site">Marketing Site</SelectItem>
                  <SelectItem value="mobile_app">Mobile App</SelectItem>
                  <SelectItem value="design">Design / Creative</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
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
