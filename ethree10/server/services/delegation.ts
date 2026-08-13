import { TRPCError } from "@trpc/server";
import type { BudgetApprovalDelegation } from "@prisma/client";
import { db } from "@/server/db/client";
import { AuditService } from "@/server/services/audit";
import { NotificationService } from "@/server/services/notification";
import { requireAgencyAction } from "@/server/services/agency";
import { assertSeparationOfDuties } from "@/server/auth/permissions";
import {
  EXPIRY_WARNING_DAYS,
  MAX_DELEGATION_DAYS,
  activeDelegationFor,
  activeDelegationWhere,
} from "@/server/services/delegation-window";

export { MAX_DELEGATION_DAYS, EXPIRY_WARNING_DAYS };

/**
 * Time-boxed delegation of budget approval.
 *
 * The Chief Executive is the only role holding `budget.approve`, which
 * `GOVERNANCE-AND-JOURNEYS.md` states and `scripts/verify-governance.ts`
 * asserts. That is deliberately not relaxed to keep approval attributable to one
 * person — so when the executive is away, approval is granted per-user for a
 * fixed window instead, and every use of it is recorded as delegated.
 *
 * See docs/coo-role-plan.md §4.
 */

function governanceError(message: string): TRPCError {
  return new TRPCError({ code: "FORBIDDEN", message });
}

export class DelegationService {
  /**
   * The delegation in force for a user right now, or null.
   *
   * Active means: not revoked, started, and not yet expired. All three are
   * checked in the query rather than in JS so a stale row can never leak
   * approval rights through a code path that forgot one of them.
   */
  static async activeFor(userId: string, now = new Date()) {
    return activeDelegationFor(userId, now);
  }

  /** Every delegation currently in force, for display and for the CEO's report. */
  static async listActive(now = new Date()) {
    return db.budgetApprovalDelegation.findMany({
      where: activeDelegationWhere(now),
      orderBy: { expiresAt: "asc" },
      include: {
        delegate: { select: { id: true, name: true, email: true } },
        grantedBy: { select: { id: true, name: true } },
      },
    });
  }

  /** History, including revoked and expired rows — the audit view. */
  static async history(limit = 50) {
    return db.budgetApprovalDelegation.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        delegate: { select: { id: true, name: true, email: true } },
        grantedBy: { select: { id: true, name: true } },
        revokedBy: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Grant approval authority to someone else.
   *
   * Only `budget.delegate` holders — the Chief Executive — may call this. Any
   * delegation already in force is revoked in the same transaction, so "who
   * could approve on date X" is always answerable from a single row.
   */
  static async grant(args: {
    actorId: string;
    delegateId: string;
    reason: string;
    expiresAt: Date;
    now?: Date;
  }): Promise<BudgetApprovalDelegation> {
    await requireAgencyAction(args.actorId, "budget.delegate");
    const now = args.now ?? new Date();

    if (args.delegateId === args.actorId) {
      throw governanceError(
        "You already approve budgets. Delegating to yourself would record an approval chain that proves nothing.",
      );
    }

    if (args.expiresAt <= now) {
      throw governanceError("A delegation must expire in the future.");
    }

    const maxExpiry = new Date(now.getTime() + MAX_DELEGATION_DAYS * 24 * 60 * 60 * 1000);
    if (args.expiresAt > maxExpiry) {
      throw governanceError(
        `A delegation may run for at most ${MAX_DELEGATION_DAYS} days. Renew it if the absence lasts longer.`,
      );
    }

    if (!args.reason.trim()) {
      throw governanceError("Record why approval is being delegated — the audit trail is the point.");
    }

    const delegate = await db.user.findUnique({
      where: { id: args.delegateId },
      select: {
        id: true,
        name: true,
        deactivatedAt: true,
        memberships: {
          where: { removedAt: null, acceptedAt: { not: null } },
          select: { role: true },
        },
      },
    });
    if (!delegate) throw new TRPCError({ code: "NOT_FOUND", message: "That user does not exist." });
    if (delegate.deactivatedAt) {
      throw governanceError("That account is deactivated.");
    }
    if (delegate.memberships.length === 0) {
      throw governanceError("That user holds no agency role, so they cannot be given approval authority.");
    }

    // A delegate who could also confirm the payment would be both halves of the
    // control this whole model exists to preserve.
    assertSeparationOfDuties([...delegate.memberships.map((m) => m.role), "chief_executive"]);

    const created = await db.$transaction(async (tx) => {
      const superseded = await tx.budgetApprovalDelegation.updateMany({
        where: { revokedAt: null, expiresAt: { gt: now } },
        data: { revokedAt: now, revokedById: args.actorId },
      });

      const delegation = await tx.budgetApprovalDelegation.create({
        data: {
          grantedById: args.actorId,
          delegateId: args.delegateId,
          reason: args.reason.trim(),
          startsAt: now,
          expiresAt: args.expiresAt,
        },
      });

      return { delegation, supersededCount: superseded.count };
    });

    await AuditService.log({
      actorId: args.actorId,
      action: "budget.delegation.granted",
      entityType: "BudgetApprovalDelegation",
      entityId: created.delegation.id,
      after: {
        delegateId: args.delegateId,
        expiresAt: args.expiresAt.toISOString(),
        reason: args.reason.trim(),
        supersededActiveDelegations: created.supersededCount,
      },
    });

    await NotificationService.create({
      userId: args.delegateId,
      kind: "approval_requested",
      title: "You can now approve budgets",
      body: `Delegated until ${args.expiresAt.toDateString()}. Reason: ${args.reason.trim()}`,
      link: "/budgets",
      entityType: "BudgetApprovalDelegation",
      entityId: created.delegation.id,
      allowDuplicate: true,
    });

    return created.delegation;
  }

  /** End a delegation early. The row is kept; history stays auditable. */
  static async revoke(args: { actorId: string; delegationId: string; now?: Date }) {
    await requireAgencyAction(args.actorId, "budget.delegate");
    const now = args.now ?? new Date();

    const existing = await db.budgetApprovalDelegation.findUnique({
      where: { id: args.delegationId },
    });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Delegation not found." });
    if (existing.revokedAt) {
      throw governanceError("That delegation has already been revoked.");
    }

    const updated = await db.budgetApprovalDelegation.update({
      where: { id: args.delegationId },
      data: { revokedAt: now, revokedById: args.actorId },
    });

    await AuditService.log({
      actorId: args.actorId,
      action: "budget.delegation.revoked",
      entityType: "BudgetApprovalDelegation",
      entityId: updated.id,
      before: { revokedAt: null },
      after: { revokedAt: now.toISOString(), delegateId: updated.delegateId },
    });

    await NotificationService.create({
      userId: updated.delegateId,
      kind: "approval_requested",
      title: "Budget approval authority ended",
      body: "The Chief Executive has revoked your delegated approval.",
      link: "/budgets",
      entityType: "BudgetApprovalDelegation",
      entityId: updated.id,
      allowDuplicate: true,
    });

    return updated;
  }

  /**
   * Delegations expiring inside the warning window. Drives the reminder so a
   * 90-day grant cannot quietly outlive the absence that justified it.
   */
  static async expiringSoon(now = new Date()) {
    const threshold = new Date(now.getTime() + EXPIRY_WARNING_DAYS * 24 * 60 * 60 * 1000);
    return db.budgetApprovalDelegation.findMany({
      where: {
        revokedAt: null,
        startsAt: { lte: now },
        expiresAt: { gt: now, lte: threshold },
      },
      include: {
        delegate: { select: { id: true, name: true } },
        grantedBy: { select: { id: true, name: true } },
      },
    });
  }
}
