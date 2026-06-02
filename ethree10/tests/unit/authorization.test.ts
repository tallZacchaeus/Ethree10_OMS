import { describe, it, expect } from "vitest";
import { can } from "@/server/auth/permissions";
import type { AuthContext } from "@/server/auth/permissions";

const memberCtx: AuthContext = { isSuperAdmin: false, roles: ["member"] };
const agencyAdminCtx: AuthContext = { isSuperAdmin: false, roles: ["agency_admin"] };
const superAdminCtx: AuthContext = { isSuperAdmin: true, roles: [] };

describe("permissions.can", () => {
  it("super_admin can do anything", () => {
    expect(can(superAdminCtx, "workspace.archive")).toBe(true);
    expect(can(superAdminCtx, "integration.manage")).toBe(true);
  });

  it("agency_admin can manage workspace", () => {
    expect(can(agencyAdminCtx, "workspace.update")).toBe(true);
    expect(can(agencyAdminCtx, "department.create")).toBe(true);
  });

  it("member cannot manage workspace", () => {
    expect(can(memberCtx, "workspace.update")).toBe(false);
    expect(can(memberCtx, "department.create")).toBe(false);
  });

  it("member can create requests", () => {
    expect(can(memberCtx, "request.create")).toBe(true);
    expect(can(memberCtx, "request.approve")).toBe(false);
  });

  it("requester_observer is read-only", () => {
    const ctx: AuthContext = { isSuperAdmin: false, roles: ["requester_observer"] };
    expect(can(ctx, "request.read")).toBe(true);
    expect(can(ctx, "request.create")).toBe(false);
  });
});
