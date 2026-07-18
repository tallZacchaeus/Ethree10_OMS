import { TRPCError } from "@trpc/server";
import type { Role } from "@prisma/client";
import { db } from "@/server/db/client";
import { can, type Action, type AuthContext } from "@/server/auth/permissions";

/**
 * The agency is implicit and Membership is staff-only. Triage and management authorization
 * resolve from accepted, active staff memberships.
 */
export async function getAgencyAuthContext(userId: string): Promise<AuthContext> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  const memberships = await db.membership.findMany({
      where: {
        userId,
        removedAt: null,
        acceptedAt: { not: null },
      },
      select: { role: true, canManageProjects: true },
    });
  const roles: Role[] = memberships.map((m) => m.role);
  return {
    isSuperAdmin: user?.isSuperAdmin ?? false,
    roles,
    capabilities: { canManageProjects: memberships.some((m) => m.canManageProjects) },
  };
}

/** Throws FORBIDDEN unless the caller has an agency role granting `action`. */
export async function requireAgencyAction(
  userId: string,
  action: Action,
): Promise<AuthContext> {
  const ctx = await getAgencyAuthContext(userId);
  if (!can(ctx, action)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Agency permission required: ${action}`,
    });
  }
  return ctx;
}
