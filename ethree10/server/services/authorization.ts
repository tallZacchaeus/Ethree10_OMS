import { TRPCError } from "@trpc/server";
import type { Role } from "@prisma/client";
import { db } from "@/server/db/client";
import { can, type Action, type AuthContext } from "@/server/auth/permissions";

export interface ResolvedContext extends AuthContext {
  userId: string;
  /** The caller's client organization, or null if they are agency staff. */
  organizationId: string | null;
  departmentId: string | null;
  subUnitId: string | null;
  membershipIds: string[];
}

export class AuthorizationService {
  /**
   * Resolve the caller's effective permissions from all of their memberships. Agency staff
   * have org-null memberships (global); clients have an org membership. Data isolation for
   * clients is enforced separately via org-scoped queries.
   */
  static async resolve(userId: string): Promise<ResolvedContext> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isSuperAdmin: true },
    });
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found." });
    }

    const memberships = await db.membership.findMany({
      where: { userId, removedAt: null, acceptedAt: { not: null } },
      select: {
        id: true,
        role: true,
        organizationId: true,
        departmentId: true,
        subUnitId: true,
        canManageProjects: true,
      },
    });

    const roles: Role[] = memberships.map((m) => m.role);

    return {
      userId,
      isSuperAdmin: user.isSuperAdmin,
      organizationId: memberships.find((m) => m.organizationId)?.organizationId ?? null,
      departmentId: memberships[0]?.departmentId ?? null,
      subUnitId: memberships[0]?.subUnitId ?? null,
      membershipIds: memberships.map((m) => m.id),
      roles,
      capabilities: {
        canManageProjects: memberships.some((m) => m.canManageProjects),
      },
    };
  }

  static can(ctx: AuthContext, action: Action): boolean {
    return can(ctx, action);
  }

  static async require(userId: string, action: Action): Promise<ResolvedContext> {
    const ctx = await AuthorizationService.resolve(userId);
    if (!can(ctx, action)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${action}`,
      });
    }
    return ctx;
  }
}
