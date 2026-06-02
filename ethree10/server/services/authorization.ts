import { TRPCError } from "@trpc/server";
import type { Role } from "@prisma/client";
import { db } from "@/server/db/client";
import { can, type Action, type AuthContext } from "@/server/auth/permissions";

export interface ResolvedContext extends AuthContext {
  userId: string;
  workspaceId: string | null;
  departmentId: string | null;
  subUnitId: string | null;
  membershipIds: string[];
}

export class AuthorizationService {
  /**
   * Resolve the caller's effective permissions inside an optional workspace.
   */
  static async resolve(
    userId: string,
    workspaceId?: string | null,
  ): Promise<ResolvedContext> {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, isSuperAdmin: true },
    });
    if (!user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found." });
    }

    const memberships = workspaceId
      ? await db.membership.findMany({
          where: { userId, workspaceId, removedAt: null, acceptedAt: { not: null } },
          select: {
            id: true,
            role: true,
            departmentId: true,
            subUnitId: true,
          },
        })
      : [];

    const roles: Role[] = memberships.map((m) => m.role);

    return {
      userId,
      isSuperAdmin: user.isSuperAdmin,
      workspaceId: workspaceId ?? null,
      departmentId: memberships[0]?.departmentId ?? null,
      subUnitId: memberships[0]?.subUnitId ?? null,
      membershipIds: memberships.map((m) => m.id),
      roles,
    };
  }

  static can(ctx: AuthContext, action: Action): boolean {
    return can(ctx, action);
  }

  static async require(
    userId: string,
    action: Action,
    workspaceId?: string | null,
  ): Promise<ResolvedContext> {
    const ctx = await AuthorizationService.resolve(userId, workspaceId);
    if (!can(ctx, action)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Missing permission: ${action}`,
      });
    }
    return ctx;
  }
}
