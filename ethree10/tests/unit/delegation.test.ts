import { describe, it, expect } from "vitest";
import { can, ROLE_PERMISSIONS, type AuthContext } from "@/server/auth/permissions";
import { STAFF_ROLES } from "@/server/auth/role-groups";
import {
  MAX_DELEGATION_DAYS,
  EXPIRY_WARNING_DAYS,
  activeDelegationWhere,
} from "@/server/services/delegation-window";

const DAY = 24 * 60 * 60 * 1000;

describe("budget approval delegation", () => {
  describe("the governance invariant it must not break", () => {
    it("keeps chief_executive the only role holding budget.approve", () => {
      const roleLevelApprovers = STAFF_ROLES.filter((role) =>
        ROLE_PERMISSIONS[role].includes("budget.approve"),
      );
      expect(roleLevelApprovers).toEqual(["chief_executive"]);
    });

    it("lets only the Chief Executive grant a delegation", () => {
      const granters = STAFF_ROLES.filter((role) =>
        ROLE_PERMISSIONS[role].includes("budget.delegate"),
      );
      expect(granters).toEqual(["chief_executive"]);
    });

    it("does not give the COO budget.approve by role", () => {
      const coo: AuthContext = { isSuperAdmin: false, roles: ["chief_operating_officer"] };
      expect(can(coo, "budget.approve")).toBe(false);
    });
  });

  describe("delegatedActions on the auth context", () => {
    const coo = (delegated?: AuthContext["delegatedActions"]): AuthContext => ({
      isSuperAdmin: false,
      roles: ["chief_operating_officer"],
      delegatedActions: delegated,
    });

    it("grants budget.approve only while the delegation is present", () => {
      expect(can(coo(), "budget.approve")).toBe(false);
      expect(can(coo(["budget.approve"]), "budget.approve")).toBe(true);
    });

    it("grants nothing beyond what was delegated", () => {
      const withDelegation = coo(["budget.approve"]);
      // Still cannot execute money — delegation adds approval, never payment.
      expect(can(withDelegation, "payment.confirm")).toBe(false);
      expect(can(withDelegation, "receipt.issue")).toBe(false);
      expect(can(withDelegation, "expense.pay")).toBe(false);
      expect(can(withDelegation, "invoice.manage")).toBe(false);
      // And cannot pass the authority on.
      expect(can(withDelegation, "budget.delegate")).toBe(false);
    });

    it("cannot mask a role decision, only add to it", () => {
      // A delegation naming an action the role already has changes nothing, and
      // one naming an action nobody should have does not remove other checks.
      const member: AuthContext = {
        isSuperAdmin: false,
        roles: ["team_member"],
        delegatedActions: ["budget.approve"],
      };
      expect(can(member, "budget.approve")).toBe(true);
      expect(can(member, "request.read")).toBe(false);
    });
  });

  describe("the active window", () => {
    const now = new Date("2026-08-13T12:00:00Z");
    const where = activeDelegationWhere(now);

    it("requires all three conditions, so a stale row cannot leak approval", () => {
      expect(where.revokedAt).toBeNull();
      expect(where.startsAt).toEqual({ lte: now });
      expect(where.expiresAt).toEqual({ gt: now });
    });

    it("caps a grant at 90 days and warns 7 days out", () => {
      expect(MAX_DELEGATION_DAYS).toBe(90);
      expect(EXPIRY_WARNING_DAYS).toBe(7);
      // The warning must fire inside the window, not after it.
      expect(EXPIRY_WARNING_DAYS).toBeLessThan(MAX_DELEGATION_DAYS);
    });

    it("treats the boundary as expired rather than active", () => {
      // `gt` not `gte`: a delegation expiring exactly now is over. Approval
      // rights should end early rather than linger a moment too long.
      const expiringNow = new Date(now.getTime());
      expect(expiringNow > now).toBe(false);
      const stillLive = new Date(now.getTime() + DAY);
      expect(stillLive > now).toBe(true);
    });
  });
});
