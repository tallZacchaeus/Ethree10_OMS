import { describe, it, expect } from "vitest";
import { can } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/permissions";

const memberCtx: AuthContext = { isSuperAdmin: false, roles: ["member"] };
const adminCtx: AuthContext = { isSuperAdmin: false, roles: ["admin"] };
const executiveCtx: AuthContext = { isSuperAdmin: false, roles: ["executive"] };
const superAdminCtx: AuthContext = { isSuperAdmin: true, roles: [] };

describe("permissions.can", () => {
  it("super_admin can do anything", () => {
    expect(can(superAdminCtx, "workspace.archive")).toBe(true);
    expect(can(superAdminCtx, "integration.manage")).toBe(true);
  });

  it("admin can manage workspace", () => {
    expect(can(adminCtx, "workspace.update")).toBe(true);
    expect(can(adminCtx, "department.create")).toBe(true);
  });

  it("member cannot manage workspace", () => {
    expect(can(memberCtx, "workspace.update")).toBe(false);
    expect(can(memberCtx, "department.create")).toBe(false);
  });

  it("member can create requests", () => {
    expect(can(memberCtx, "request.create")).toBe(true);
    expect(can(memberCtx, "request.approve")).toBe(false);
  });

  it("client_viewer is read-only", () => {
    const ctx: AuthContext = { isSuperAdmin: false, roles: ["client_viewer"] };
    expect(can(ctx, "request.read")).toBe(true);
    expect(can(ctx, "request.create")).toBe(false);
  });

  describe("executive (Executive Overview)", () => {
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
      expect(can(executiveCtx, "workspace.update")).toBe(false);
      expect(can(executiveCtx, "integration.manage")).toBe(false);
    });
  });

  describe("member canManageProjects capability", () => {
    const pmCtx: AuthContext = {
      isSuperAdmin: false,
      roles: ["member"],
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
      expect(can(pmCtx, "workspace.update")).toBe(false);
      expect(can(pmCtx, "task.review")).toBe(false);
    });

    it("a plain member without the toggle cannot manage projects", () => {
      expect(can(memberCtx, "project.create")).toBe(false);
      expect(can(memberCtx, "task.assign")).toBe(false);
    });
  });
});
