import { describe, it, expect } from "vitest";
import { can } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/permissions";

const memberCtx: AuthContext = { isSuperAdmin: false, roles: ["team_member"] };
const adminCtx: AuthContext = { isSuperAdmin: false, roles: ["agency_admin"] };
const executiveCtx: AuthContext = { isSuperAdmin: false, roles: ["finance_admin"] };
const superAdminCtx: AuthContext = { isSuperAdmin: true, roles: [] };

describe("permissions.can", () => {
  it("super_admin can do anything", () => {
    expect(can(superAdminCtx, "organization.archive")).toBe(true);
    expect(can(superAdminCtx, "integration.manage")).toBe(true);
  });

  it("admin can manage organization", () => {
    expect(can(adminCtx, "organization.update")).toBe(true);
    expect(can(adminCtx, "team.create")).toBe(true);
  });

  it("member cannot manage organization", () => {
    expect(can(memberCtx, "organization.update")).toBe(false);
    expect(can(memberCtx, "team.create")).toBe(false);
  });

  it("member can create requests", () => {
    expect(can(memberCtx, "request.create")).toBe(true);
    expect(can(memberCtx, "request.approve")).toBe(false);
  });

  it("finance_admin is read-only for operations", () => {
    expect(can(executiveCtx, "request.read")).toBe(true);
    expect(can(executiveCtx, "request.create")).toBe(false);
  });

  describe("finance_admin (Executive Overview)", () => {
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
});
