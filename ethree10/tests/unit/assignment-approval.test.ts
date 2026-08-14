import { describe, it, expect } from "vitest";
import { canDecideAssignment } from "@/server/services/assignment-eligibility";
import { ROLE_PERMISSIONS } from "@/server/auth/permissions";
import { STAFF_ROLES } from "@/server/auth/role-groups";

const DIGITAL_MEDIA = "team_digital_media";
const TECH_PRODUCT = "team_tech_product";

describe("assignment approval authority", () => {
  describe("who holds the permission at all", () => {
    it("is the branch leads, and not the people who only propose", () => {
      const approvers = STAFF_ROLES.filter((role) =>
        ROLE_PERMISSIONS[role].includes("task.assignmentApprove"),
      );
      expect(approvers).toEqual(["chief_operating_officer", "agency_admin", "branch_head"]);

      // A department lead proposes; the branch head signs off. That split is the
      // whole feature, so it is asserted rather than left to the role table.
      expect(ROLE_PERMISSIONS.department_lead).toContain("task.assign");
      expect(ROLE_PERMISSIONS.department_lead).not.toContain("task.assignmentApprove");
    });

    it("does not give it to the Chief Executive, which holds no delivery writes", () => {
      expect(ROLE_PERMISSIONS.chief_executive).not.toContain("task.assignmentApprove");
    });

    it("does not give it to the person doing the work", () => {
      expect(ROLE_PERMISSIONS.team_member).not.toContain("task.assignmentApprove");
    });
  });

  describe("the permission is not enough on its own", () => {
    it("stops a branch head deciding inside the other branch", () => {
      // Otherwise `task.assignmentApprove` would let either branch head approve
      // work anywhere, which is exactly the confusion branches exist to avoid.
      expect(
        canDecideAssignment({
          holdsApprovePermission: true,
          isSuperAdmin: false,
          approverBranchIds: [DIGITAL_MEDIA],
          taskBranchId: TECH_PRODUCT,
        }),
      ).toBe(false);
    });

    it("lets a branch head decide on their own branch", () => {
      expect(
        canDecideAssignment({
          holdsApprovePermission: true,
          isSuperAdmin: false,
          approverBranchIds: [TECH_PRODUCT],
          taskBranchId: TECH_PRODUCT,
        }),
      ).toBe(true);
    });

    it("refuses anyone without the permission, branch or not", () => {
      expect(
        canDecideAssignment({
          holdsApprovePermission: false,
          isSuperAdmin: false,
          approverBranchIds: [TECH_PRODUCT],
          taskBranchId: TECH_PRODUCT,
        }),
      ).toBe(false);
    });
  });

  describe("agency-wide holders", () => {
    it("may decide anywhere, since they belong to no branch", () => {
      expect(
        canDecideAssignment({
          holdsApprovePermission: true,
          isSuperAdmin: false,
          approverBranchIds: [],
          taskBranchId: TECH_PRODUCT,
        }),
      ).toBe(true);
    });

    it("still needs the permission", () => {
      expect(
        canDecideAssignment({
          holdsApprovePermission: false,
          isSuperAdmin: false,
          approverBranchIds: [],
          taskBranchId: TECH_PRODUCT,
        }),
      ).toBe(false);
    });

    it("allows a super admin regardless", () => {
      expect(
        canDecideAssignment({
          holdsApprovePermission: false,
          isSuperAdmin: true,
          approverBranchIds: [],
          taskBranchId: TECH_PRODUCT,
        }),
      ).toBe(true);
    });
  });

  it("allows a branch head to decide on an unrouted project", () => {
    // No branch to conflict with, and refusing would strand the task.
    expect(
      canDecideAssignment({
        holdsApprovePermission: true,
        isSuperAdmin: false,
        approverBranchIds: [DIGITAL_MEDIA],
        taskBranchId: null,
      }),
    ).toBe(true);
  });
});
