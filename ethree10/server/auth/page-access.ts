import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/server/auth";
import { db } from "@/server/db/client";
import { can, type Action } from "@/server/auth/permissions";
import { getAgencyAuthContext } from "@/server/services/agency";

export async function requirePageRole(allowed: Role[]) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      isSuperAdmin: true,
      memberships: { where: { removedAt: null, acceptedAt: { not: null } }, select: { role: true } },
    },
  });
  if (!user?.isSuperAdmin && !user?.memberships.some((membership) => allowed.includes(membership.role))) {
    redirect("/dashboard?access=denied");
  }
}

/**
 * Guard a page on an action rather than a role.
 *
 * Needed wherever an action can be held by something other than a role — today
 * that is `budget.approve`, which the Chief Executive holds by role and a
 * delegate holds for a fixed window. A role-based guard on /budgets would
 * either lock out a delegated approver or admit one who is not delegated.
 */
export async function requirePageAction(action: Action) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const ctx = await getAgencyAuthContext(session.user.id);
  if (!can(ctx, action)) redirect("/dashboard?access=denied");
}
