export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppTopbar } from "@/components/layout/app-topbar";

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
  const hasStaffAccess = dbUser?.isSuperAdmin || dbUser?.memberships.some((membership) => !membership.removedAt && membership.acceptedAt);
  if (!hasStaffAccess) redirect("/unauthorized");
  // MFA is mandatory for admin and all lead roles (spec 13/Phase 2).
  const MFA_ENFORCED_ROLES = ["agency_admin", "finance_admin", "team_head"];
  const isEnforcedRole =
    dbUser?.isSuperAdmin || dbUser?.memberships.some((m) => MFA_ENFORCED_ROLES.includes(m.role));
  const cookieStore = await cookies();
  const mfaVerified = cookieStore.get("mfa-verified")?.value === session.user.id;
  const skipMfa =
    process.env.NODE_ENV === "development" || process.env["E2E_TEST_AUTH"] === "true";

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
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AppTopbar user={session.user} />
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6">
          <div className="mx-auto max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
