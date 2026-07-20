import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SecuritySettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
        <p className="mt-2 text-muted-foreground">
          Account access is managed through magic-link sign-in and staff membership status.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Two-factor authentication removed</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          MFA is no longer required or available in this app. Staff access is controlled by
          active memberships, roles, and invitation status.
        </CardContent>
      </Card>
    </div>
  );
}
