import { describe, it, expect } from "vitest";
import {
  checkAssignmentEligibility,
  type AssigneeMembership,
} from "@/server/services/assignment-eligibility";

const DIGITAL_MEDIA = "team_digital_media";
const TECH_PRODUCT = "team_tech_product";

const member = (teamId: string | null): AssigneeMembership => ({ role: "team_member", teamId });

describe("assignment eligibility", () => {
  describe("the hole this closes", () => {
    it("refuses someone from another branch", () => {
      const result = checkAssignmentEligibility({
        memberships: [member(DIGITAL_MEDIA)],
        isSuperAdmin: false,
        projectTeamId: TECH_PRODUCT,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/different branch/i);
    });

    it("refuses someone with no agency membership at all", () => {
      // There is no foreign key on Task.assigneeUserId, so before this check a
      // client could pass any id — including one for an account that had been
      // removed from the agency.
      const result = checkAssignmentEligibility({
        memberships: [],
        isSuperAdmin: false,
        projectTeamId: TECH_PRODUCT,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toMatch(/not an active member/i);
    });

    it("allows someone in the project's own branch", () => {
      expect(
        checkAssignmentEligibility({
          memberships: [member(TECH_PRODUCT)],
          isSuperAdmin: false,
          projectTeamId: TECH_PRODUCT,
        }).ok,
      ).toBe(true);
    });

    it("allows someone who belongs to several branches including this one", () => {
      expect(
        checkAssignmentEligibility({
          memberships: [member(DIGITAL_MEDIA), member(TECH_PRODUCT)],
          isSuperAdmin: false,
          projectTeamId: TECH_PRODUCT,
        }).ok,
      ).toBe(true);
    });
  });

  describe("cases a branch-only rule would have broken", () => {
    // These are why the rule is "if you belong to branches, it must be one of
    // yours" rather than "you must belong to this branch".
    it("allows agency-wide roles, which hold no branch", () => {
      for (const role of ["agency_admin", "chief_operating_officer", "finance_manager"] as const) {
        const result = checkAssignmentEligibility({
          memberships: [{ role, teamId: null }],
          isSuperAdmin: false,
          projectTeamId: TECH_PRODUCT,
        });
        expect(result.ok, `${role} should be assignable`).toBe(true);
      }
    });

    it("allows a super admin", () => {
      // can() short-circuits on isSuperAdmin everywhere else; assignment should
      // not be the one place it does not.
      expect(
        checkAssignmentEligibility({
          memberships: [],
          isSuperAdmin: true,
          projectTeamId: TECH_PRODUCT,
        }).ok,
      ).toBe(true);
    });

    it("allows staff who are not yet placed in a branch", () => {
      expect(
        checkAssignmentEligibility({
          memberships: [member(null)],
          isSuperAdmin: false,
          projectTeamId: TECH_PRODUCT,
        }).ok,
      ).toBe(true);
    });
  });

  describe("unrouted projects", () => {
    it("still requires agency membership when there is no branch to check", () => {
      expect(
        checkAssignmentEligibility({
          memberships: [],
          isSuperAdmin: false,
          projectTeamId: null,
        }).ok,
      ).toBe(false);
    });

    it("allows any active member once the project has no branch", () => {
      // Refusing here would block ordinary work over a condition the assigner
      // may not control, so membership alone is the bar.
      expect(
        checkAssignmentEligibility({
          memberships: [member(DIGITAL_MEDIA)],
          isSuperAdmin: false,
          projectTeamId: null,
        }).ok,
      ).toBe(true);
    });
  });
});
