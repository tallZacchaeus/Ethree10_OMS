import type { Role } from "@prisma/client";

export type Action =
  | "workspace.read"
  | "workspace.create"
  | "workspace.update"
  | "workspace.archive"
  | "workspace.invite"
  | "workspace.removeMember"
  | "workspace.changeRole"
  | "department.read"
  | "department.create"
  | "department.update"
  | "department.archive"
  | "subunit.read"
  | "subunit.create"
  | "subunit.update"
  | "subunit.archive"
  | "member.read"
  | "request.read"
  | "request.create"
  | "request.update"
  | "request.transition"
  | "request.route"
  | "request.approve"
  | "request.reject"
  | "request.delete"
  | "project.read"
  | "project.create"
  | "project.update"
  | "project.delete"
  | "task.read"
  | "task.create"
  | "task.update"
  | "task.assign"
  | "task.submitCompletion"
  | "task.review"
  | "task.delete"
  | "lead.read"
  | "lead.update"
  | "lead.convert"
  | "audit.read"
  | "integration.read"
  | "integration.manage"
  | "report.read"
  | "report.generate";

export interface AuthContext {
  isSuperAdmin: boolean;
  roles: Role[];
}

const ROLE_PERMISSIONS: Record<Role, Action[]> = {
  super_admin: [],
  agency_admin: [
    "workspace.read", "workspace.create", "workspace.update", "workspace.archive",
    "workspace.invite", "workspace.removeMember", "workspace.changeRole",
    "department.read", "department.create", "department.update", "department.archive",
    "subunit.read", "subunit.create", "subunit.update", "subunit.archive",
    "member.read",
    "request.read", "request.create", "request.update", "request.transition",
    "request.route", "request.approve", "request.reject", "request.delete",
    "project.read", "project.create", "project.update", "project.delete",
    "task.read", "task.create", "task.update", "task.assign", "task.review", "task.delete",
    "lead.read", "lead.update", "lead.convert",
    "audit.read",
    "integration.read", "integration.manage",
    "report.read", "report.generate",
  ],
  agency_lead: [
    "workspace.read", "workspace.invite",
    "department.read", "department.create", "department.update", "department.archive",
    "subunit.read", "subunit.create", "subunit.update", "subunit.archive",
    "member.read",
    "request.read", "request.create", "request.update", "request.transition",
    "request.route", "request.approve", "request.reject",
    "project.read", "project.create", "project.update",
    "task.read", "task.create", "task.update", "task.assign", "task.review",
    "lead.read", "lead.update", "lead.convert",
    "audit.read",
    "integration.read", "integration.manage",
    "report.read", "report.generate",
  ],
  department_lead: [
    "workspace.read",
    "department.read", "department.update",
    "subunit.read", "subunit.create", "subunit.update", "subunit.archive",
    "member.read",
    "request.read", "request.update", "request.transition", "request.route",
    "project.read", "project.create", "project.update",
    "task.read", "task.create", "task.update", "task.assign", "task.review",
    "report.read", "report.generate",
  ],
  subunit_lead: [
    "workspace.read",
    "department.read",
    "subunit.read", "subunit.update",
    "member.read",
    "request.read",
    "project.read",
    "task.read", "task.create", "task.update", "task.assign", "task.review",
    "report.read",
  ],
  member: [
    "workspace.read",
    "department.read",
    "subunit.read",
    "member.read",
    "request.read", "request.create",
    "project.read",
    "task.read", "task.update", "task.submitCompletion",
  ],
  project_manager: [
    "workspace.read",
    "department.read",
    "subunit.read",
    "member.read",
    "request.read", "request.update", "request.transition",
    "project.read", "project.create", "project.update",
    "task.read", "task.create", "task.update", "task.assign",
    "report.read",
  ],
  requester_admin: [
    "workspace.read", "workspace.invite",
    "request.read", "request.create", "request.update",
    "project.read",
  ],
  requester_member: [
    "workspace.read",
    "request.read", "request.create",
    "project.read",
  ],
  requester_observer: [
    "workspace.read",
    "request.read",
    "project.read",
  ],
};

export function can(ctx: AuthContext, action: Action): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.roles.some((role) => ROLE_PERMISSIONS[role]?.includes(action));
}

export function requirePermission(ctx: AuthContext, action: Action): void {
  if (!can(ctx, action)) {
    throw new Error(`Forbidden: missing permission "${action}".`);
  }
}
