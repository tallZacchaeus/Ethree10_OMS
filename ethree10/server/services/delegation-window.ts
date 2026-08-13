import { db } from "@/server/db/client";

/**
 * The "is a delegation in force" question, on its own.
 *
 * A leaf module by design: `agency.ts` needs this to build an auth context, and
 * `delegation.ts` needs `agency.ts` for permission checks. Putting the predicate
 * here means neither imports the other, so there is no cycle to break later at
 * an awkward moment.
 *
 * Defined once so the three conditions that make a delegation live cannot drift
 * apart between callers.
 */

/** Longest a single grant may run before it must be renewed deliberately. */
export const MAX_DELEGATION_DAYS = 90;

/** Warn this many days before expiry, so a live delegation cannot go unnoticed. */
export const EXPIRY_WARNING_DAYS = 7;

/** Not revoked, already started, not yet expired. All three, always. */
export function activeDelegationWhere(now: Date) {
  return { revokedAt: null, startsAt: { lte: now }, expiresAt: { gt: now } } as const;
}

export async function activeDelegationFor(userId: string, now = new Date()) {
  return db.budgetApprovalDelegation.findFirst({
    where: { delegateId: userId, ...activeDelegationWhere(now) },
    orderBy: { createdAt: "desc" },
  });
}
