"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { formatDate } from "@/lib/format";
import { CreateTemplateDialog } from "@/components/templates/create-template-dialog";
import { useAgencyContext } from "@/components/providers/agency-provider";
import { AGENCY_CONFIG_ROLES } from "@/server/auth/role-groups";
import type { Role } from "@prisma/client";

export default function TemplatesPage() {
  // Was `const isSuperAdmin = false` with an empty roles array, so isAgencyAdmin
  // was always false and nobody could create a template — including a super
  // admin. That also disabled "Apply template" downstream in every practical
  // sense: the project page offered to apply templates that could not be
  // authored.
  const { isSuperAdmin, roles } = useAgencyContext();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // AGENCY_CONFIG_ROLES rather than a literal "agency_admin": the COO holds
  // configuration authority too, and inlined role arrays are how the previous
  // model drifted apart.
  const isAgencyAdmin =
    isSuperAdmin || roles.some((r) => AGENCY_CONFIG_ROLES.includes(r as Role));

  const { data: templates, isLoading, refetch } = trpc.templates.list.useQuery();

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading templates...</div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Project Templates</h2>
          <p className="text-muted-foreground">Manage templates to standardize project creation.</p>
        </div>
        {isAgencyAdmin && (
          <Button onClick={() => setShowCreateDialog(true)}>
            Create Template
          </Button>
        )}
      </div>

      {templates?.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates found.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates?.map((t) => (
            <Card key={t.id}>
              <CardHeader>
                <CardTitle className="text-lg">{t.name}</CardTitle>
                <CardDescription>{t.description || "No description"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Project Type:</span>
                  <span className="font-medium">{t.projectType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tasks:</span>
                  <span className="font-medium">{(t.tasks as unknown[]).length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">{formatDate(t.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <CreateTemplateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={() => void refetch()}
      />
    </div>
  );
}
