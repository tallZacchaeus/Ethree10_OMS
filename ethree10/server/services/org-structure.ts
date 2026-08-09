import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "@prisma/client";

export interface LeadSummary {
  id: string;
  name: string;
  email: string;
}

/**
 * `Team.leadId` and `SubUnit.leadId` are plain columns rather than relations, so
 * Prisma cannot join the lead in. Resolve them in one query and hand back a map.
 */
export async function resolveLeads(
  db: PrismaClient,
  ids: (string | null)[],
): Promise<Map<string, LeadSummary>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();

  const users = await db.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}

/**
 * A lead must be somebody who actually works here. Without this check any user
 * id — a removed member, a client contact, a typo — could be written into
 * `leadId`, and the screens that route work to "the branch lead" would go quiet
 * with no error anywhere.
 */
export async function assertLeadIsActiveMember(
  db: PrismaClient,
  userId: string,
  scope: "branch" | "department",
): Promise<void> {
  const membership = await db.membership.findFirst({
    where: { userId, removedAt: null },
    select: { id: true },
  });
  if (!membership) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `A ${scope} lead must be a current member of the agency.`,
    });
  }
}
