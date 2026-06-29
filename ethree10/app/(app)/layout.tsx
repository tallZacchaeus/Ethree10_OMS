export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";
import { WorkspaceProvider } from "@/components/providers/workspace-provider";
import { db } from "@/server/db/client";
import { cookies } from "next/headers";
import { MfaChallenge } from "@/components/auth/mfa-challenge";
import { MfaEnforceSetup } from "@/components/auth/mfa-enforce-setup";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    include: { memberships: true }
  });

  const isMfaEnabled = dbUser?.mfaEnabled;
  // MFA is mandatory for admin and all lead roles (spec 13/Phase 2).
  const MFA_ENFORCED_ROLES = ["admin", "executive", "department_lead"];
  const isEnforcedRole =
    dbUser?.isSuperAdmin || dbUser?.memberships.some((m) => MFA_ENFORCED_ROLES.includes(m.role));
  const mfaVerified = cookies().get("mfa-verified")?.value === "true";
  const skipMfa = process.env.NODE_ENV === "development";

  if (!skipMfa && isMfaEnabled && !mfaVerified) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <MfaChallenge />
      </div>
    );
  }

  if (!skipMfa && isEnforcedRole && !isMfaEnabled) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted/30">
        <MfaEnforceSetup />
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <div className="flex h-screen overflow-hidden">
        <AppSidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <AppTopbar user={session.user} />
          <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
            <div className="mx-auto max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
