"use client";

import { useState, useEffect } from "react";
import { Search, FolderKanban, CheckCircle2 } from "lucide-react";
import { trpc } from "@/lib/trpc/client";
import { PageHeader } from "@/components/ui-ext/page-header";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/ui-ext/status-pill";

export default function KnowledgeBasePage() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(handler);
  }, [query]);

  const { data: projects, isLoading } = trpc.projects.getKnowledgeBase.useQuery(
    { query: debouncedQuery }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Knowledge Base"
        description="Search past projects, reusable templates, and lessons learned."
      />

      <div className="relative max-w-2xl">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by project name, description, or keyword..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9 h-12"
        />
      </div>

      {isLoading ? (
        <div className="text-muted-foreground py-12 text-center">Loading knowledge base...</div>
      ) : projects?.length === 0 ? (
        <div className="text-muted-foreground py-12 text-center">No past projects found.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects?.map((project) => (
            <Card key={project.id} className="hover:border-brand-300 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-4">
                  <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
                  <StatusPill kind="project" value={project.status} />
                </div>
                <div className="text-xs font-medium text-brand-600">
                  {project.workspace.name} • {project.department?.name}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {project.description || "No description provided."}
                </p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-4 w-4" /> {project.tasks.length} tasks
                  </span>
                  <span className="flex items-center gap-1">
                    <FolderKanban className="h-4 w-4" /> Delivered {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
