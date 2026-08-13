import { describe, it, expect } from "vitest";
import { can, assertSeparationOfDuties, ROLE_PERMISSIONS } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/permissions";
import {
  BUDGET_APPROVER_ROLES,
  REQUEST_ACCESS_ROLES,
  STAFF_ROLES,
  hasAgencyWideScope,
} from "@/server/auth/role-groups";

const memberCtx: AuthContext = { isSuperAdmin: false, roles: ["team_member"] };
const adminCtx: AuthContext = { isSuperAdmin: false, roles: ["agency_admin"] };
const executiveCtx: AuthContext = { isSuperAdmin: false, roles: ["finance_manager"] };
const superAdminCtx: AuthContext = { isSuperAdmin: true, roles: [] };

describe("permissions.can", () => {
  it("super_admin can do anything", () => {
    expect(can(superAdminCtx, "organization.archive")).toBe(true);
    expect(can(superAdminCtx, "integration.manage")).toBe(true);
  });

  it("admin can manage organization", () => {
    expect(can(adminCtx, "organization.update")).toBe(true);
    expect(can(adminCtx, "organization.invite")).toBe(true);
    expect(can(adminCtx, "subunit.create")).toBe(true);
    expect(can(adminCtx, "service.manage")).toBe(true);
  });

  // Structural and destructive powers moved to the Chief Operating Officer so
  // that role genuinely outranks this one. Removing them from here is the
  // change that made the difference real rather than nominal.
  it("admin cannot reshape the agency or destroy records", () => {
    expect(can(adminCtx, "team.create")).toBe(false);
    expect(can(adminCtx, "team.archive")).toBe(false);
    expect(can(adminCtx, "subunit.archive")).toBe(false);
    expect(can(adminCtx, "organization.archive")).toBe(false);
    expect(can(adminCtx, "request.delete")).toBe(false);
    expect(can(adminCtx, "project.delete")).toBe(false);
    expect(can(adminCtx, "task.delete")).toBe(false);
    expect(can(adminCtx, "integration.manage")).toBe(false);
    // Still reads integrations — it just cannot connect or reconfigure them.
    expect(can(adminCtx, "integration.read")).toBe(true);
  });

  it("member cannot manage organization", () => {
    expect(can(memberCtx, "organization.update")).toBe(false);
    expect(can(memberCtx, "team.create")).toBe(false);
  });

  it("member can raise a request but not read the pipeline", () => {
    // Raising work is open to everyone; reading other people's requests is not.
    // Their own submissions come back via myRequests, which is self-scoped.
    expect(can(memberCtx, "request.create")).toBe(true);
    expect(can(memberCtx, "request.read")).toBe(false);
    expect(can(memberCtx, "request.approve")).toBe(false);
    expect(can(memberCtx, "task.read")).toBe(true);
  });

  it("leads retain request access", () => {
    const branchHeadCtx: AuthContext = { isSuperAdmin: false, roles: ["branch_head"] };
    const deptLeadCtx: AuthContext = { isSuperAdmin: false, roles: ["department_lead"] };
    expect(can(branchHeadCtx, "request.read")).toBe(true);
    expect(can(deptLeadCtx, "request.read")).toBe(true);
  });

  it("finance_manager is read-only for operations", () => {
    expect(can(executiveCtx, "request.read")).toBe(true);
    expect(can(executiveCtx, "request.create")).toBe(false);
  });

  describe("finance_manager (Executive Overview)", () => {
    it("reads agency-wide and may comment, but cannot act operationally", () => {
      expect(can(executiveCtx, "request.read")).toBe(true);
      expect(can(executiveCtx, "project.read")).toBe(true);
      expect(can(executiveCtx, "audit.read")).toBe(true);
      expect(can(executiveCtx, "report.generate")).toBe(true);
      expect(can(executiveCtx, "comment.create")).toBe(true);
    });

    it("has no write, approval, or management power", () => {
      expect(can(executiveCtx, "request.create")).toBe(false);
      expect(can(executiveCtx, "request.approve")).toBe(false);
      expect(can(executiveCtx, "project.create")).toBe(false);
      expect(can(executiveCtx, "task.assign")).toBe(false);
      expect(can(executiveCtx, "organization.update")).toBe(false);
      expect(can(executiveCtx, "integration.manage")).toBe(false);
    });
  });

  describe("member canManageProjects capability", () => {
    const pmCtx: AuthContext = {
      isSuperAdmin: false,
      roles: ["team_member"],
      capabilities: { canManageProjects: true },
    };

    it("grants project + task management on top of the member role", () => {
      expect(can(pmCtx, "project.create")).toBe(true);
      expect(can(pmCtx, "project.update")).toBe(true);
      expect(can(pmCtx, "task.create")).toBe(true);
      expect(can(pmCtx, "task.assign")).toBe(true);
    });

    it("does not grant lead-only powers like approvals or workspace management", () => {
      expect(can(pmCtx, "request.approve")).toBe(false);
      expect(can(pmCtx, "organization.update")).toBe(false);
      expect(can(pmCtx, "task.review")).toBe(false);
    });

    it("a plain member without the toggle cannot manage projects", () => {
      expect(can(memberCtx, "project.create")).toBe(false);
      expect(can(memberCtx, "task.assign")).toBe(false);
    });
  });

  describe("chief_operating_officer", () => {
    const cooCtx: AuthContext = { isSuperAdmin: false, roles: ["chief_operating_officer"] };

    // Seniority cannot be declared in this codebase — ROLE_PERMISSIONS is a flat
    // map with no hierarchy — so it only exists as the union of actions below.
    // These tests are what keep the claim true as other roles change.
    // Reads ROLE_PERMISSIONS directly rather than a list written here: a list in
    // a test cannot catch an action that did not exist when the test was
    // written, and silent decay is the whole failure mode being guarded against.
    it("holds every action the management chain holds", () => {
      for (const role of ["agency_admin", "branch_head", "department_lead"] as const) {
        const missing = ROLE_PERMISSIONS[role].filter((action) => !can(cooCtx, action));
        expect(missing, `COO is missing actions held by ${role}`).toEqual([]);
      }
    });

    // The COO outranks the Agency Admin by exactly these eight: reshaping the
    // agency, destroying records, and connecting external systems. If this list
    // changes, the org decision behind it changed too — see §3 of
    // docs/coo-role-plan.md.
    it("outranks agency_admin — strictly more, never merely equal", () => {
      const beyondAdmin = ROLE_PERMISSIONS.chief_operating_officer
        .filter((action) => !ROLE_PERMISSIONS.agency_admin.includes(action))
        .sort();

      expect(beyondAdmin).toEqual(
        [
          "organization.archive",
          "team.create",
          "team.archive",
          "subunit.archive",
          "request.delete",
          "project.delete",
          "task.delete",
          "integration.manage",
        ].sort(),
      );
    });

    it("never approves a budget by role — that is delegated, per the governance model", () => {
      expect(can(cooCtx, "budget.approve")).toBe(false);
      expect(can(cooCtx, "budget.submit")).toBe(true);
      expect(can(cooCtx, "budget.read")).toBe(true);
    });

    it("cannot execute money, so a delegated approver can never also pay", () => {
      expect(can(cooCtx, "payment.confirm")).toBe(false);
      expect(can(cooCtx, "receipt.issue")).toBe(false);
      expect(can(cooCtx, "expense.pay")).toBe(false);
      expect(can(cooCtx, "invoice.manage")).toBe(false);
      // Reads them, never issues them.
      expect(can(cooCtx, "invoice.read")).toBe(true);
      expect(can(cooCtx, "receipt.read")).toBe(true);
    });

    it("runs operations and delivery", () => {
      expect(can(cooCtx, "request.route")).toBe(true);
      expect(can(cooCtx, "task.assign")).toBe(true);
      expect(can(cooCtx, "task.review")).toBe(true);
      expect(can(cooCtx, "organization.changeRole")).toBe(true);
      expect(can(cooCtx, "audit.read")).toBe(true);
    });

    it("has agency-wide read scope", () => {
      expect(hasAgencyWideScope(cooCtx)).toBe(true);
      expect(REQUEST_ACCESS_ROLES).toContain("chief_operating_officer");
    });

    it("cannot be held alongside Finance Manager", () => {
      expect(() =>
        assertSeparationOfDuties(["chief_operating_officer", "finance_manager"]),
      ).toThrow(/separation of duties/i);
      expect(() => assertSeparationOfDuties(["chief_operating_officer"])).not.toThrow();
    });

    it("leaves the Chief Executive the only role-level budget approver", () => {
      expect(BUDGET_APPROVER_ROLES).toEqual(["chief_executive"]);
      const roleLevelApprovers = STAFF_ROLES.filter((role) =>
        can({ isSuperAdmin: false, roles: [role] }, "budget.approve"),
      );
      expect(roleLevelApprovers).toEqual(["chief_executive"]);
    });
  });
});
