import { TRPCError } from "@trpc/server";
import type { Role } from "@prisma/client";
import { db } from "@/server/db/client";
import { can, type Action, type AuthContext } from "@/server/auth/permissions";

/**
 * The single agency workspace. Requests submitted by client workspaces are
 * triaged by agency staff whose roles live in this workspace, so triage
 * authorization resolves against agency membership rather than the active
 * (client) workspace.
 */
export async function getAgencyWorkspaceId(): Promise<string | null> {
  const ws = await db.workspace.findFirst({
    where: { type: "agency" },
    select: { id: true },
  });
  return ws?.id ?? null;
}

export async function getAgencyAuthContext(userId: string): Promise<AuthContext> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true },
  });
  const agencyId = await getAgencyWorkspaceId();
  const roles: Role[] = agencyId
    ? (
        await db.membership.findMany({
          where: {
            userId,
            workspaceId: agencyId,
            removedAt: null,
            acceptedAt: { not: null },
          },
          select: { role: true },
        })
      ).map((m) => m.role)
    : [];
  return { isSuperAdmin: user?.isSuperAdmin ?? false, roles };
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
