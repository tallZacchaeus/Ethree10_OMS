import { describe, it, expect } from "vitest";
import { can, ROLE_PERMISSIONS, type AuthContext } from "@/server/auth/permissions";

/**
 * Super admin is granted by the `User.isSuperAdmin` boolean, not by the
 * `super_admin` membership role — whose entry in ROLE_PERMISSIONS is empty.
 *
 * That is deliberate, but it is surprising enough to be worth pinning. Anything
 * that reasons about capability from ROLE_PERMISSIONS alone — an access review,
 * an admin screen, a permissions matrix, a future agent reading this repo —
 * will conclude the super admin can do nothing, and be wrong. These tests state
 * the real relationship so it cannot drift without something failing.
 */
const ctx = (over: Partial<AuthContext>): AuthContext =>
  ({ userId: "u1", isSuperAdmin: false, roles: [], ...over }) as AuthContext;

describe("super admin", () => {
  it("is granted by the flag, for every action", () => {
    const superAdmin = ctx({ isSuperAdmin: true });
    for (const action of ["team.create", "budget.approve", "payment.confirm", "request.delete"] as const) {
      expect(can(superAdmin, action)).toBe(true);
    }
  });

  it("grants nothing through the membership role on its own", () => {
    // The trap. Someone handed the super_admin ROLE, without the boolean, has
    // no permissions at all — which reads as a broken account rather than a
    // deliberate design.
    const roleOnly = ctx({ roles: ["super_admin"] });
    expect(can(roleOnly, "team.create")).toBe(false);
    expect(can(roleOnly, "budget.approve")).toBe(false);
  });

  it("keeps the role's permission list empty, matching the flag-based design", () => {
    // If someone fills this in, the two mechanisms have diverged and one of
    // these tests should be revisited rather than quietly updated.
    expect(ROLE_PERMISSIONS.super_admin).toEqual([]);
  });

  it("does not let the flag be simulated by any ordinary role", () => {
    for (const role of ["chief_executive", "chief_operating_officer", "agency_admin"] as const) {
      const context = ctx({ roles: [role] });
      // Only the Chief Executive approves budgets; nobody but a super admin
      // gets everything.
      const all = (["team.create", "budget.approve", "payment.confirm"] as const).every((action) =>
        can(context, action),
      );
      expect(all).toBe(false);
    }
  });
});
