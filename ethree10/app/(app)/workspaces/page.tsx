import type { Metadata } from "next";

export const metadata: Metadata = { title: "Workspaces" };

export default function WorkspacesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Workspaces</h2>
        <p className="text-sm text-muted-foreground">
          Switch between workspaces you are a member of.
        </p>
      </div>
      <div className="rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
        <p className="text-sm text-muted-foreground">
          Workspace list will load here. Use the switcher in the topbar to change context.
        </p>
      </div>
    </div>
  );
}
