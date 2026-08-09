import type { Role } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { db } from "@/server/db/client";
import { assertSeparationOfDuties } from "@/server/auth/permissions";

/**
 * Refuse a role assignment that would give one person two roles which must stay
 * separate — today, Chief Executive and Finance Manager.
 *
 * This lives here, shared, rather than inside a single router. It was previously
 * private to `organizations.ts`, so `members.updateMembership` — the mutation the
 * People screen actually calls — bypassed it entirely. The control existed and
 * the everyday path went around it.
 *
 * Every mutation that writes `Membership.role` must call this.
 */
export async function assertRoleSetAllowed(
  userId: string,
  incomingRole: Role,
  excludeMembershipId?: string,
): Promise<void> {
  const others = await db.membership.findMany({
    where: {
      userId,
      removedAt: null,
      ...(excludeMembershipId ? { id: { not: excludeMembershipId } } : {}),
    },
    select: { role: true },
  });

  try {
    assertSeparationOfDuties([...others.map((membership) => membership.role), incomingRole]);
  } catch (error) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: error instanceof Error ? error.message : "Role combination not allowed.",
    });
  }
}
