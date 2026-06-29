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
  | "comment.create"
  | "lead.read"
  | "lead.update"
  | "lead.convert"
  | "audit.read"
  | "integration.read"
  | "integration.manage"
  | "report.read"
  | "report.generate";

/**
 * Per-membership capability flags. These grant a small, fixed set of extra actions on top of
 * the member's role — used so a plain `member` can be allowed to manage projects without
 * promoting them to a lead role.
 */
export interface Capabilities {
  canManageProjects: boolean;
}

export interface AuthContext {
  isSuperAdmin: boolean;
  roles: Role[];
  capabilities?: Capabilities;
}

/** Actions unlocked by the `canManageProjects` capability toggle. */
const CAN_MANAGE_PROJECTS_ACTIONS: Action[] = [
  "project.create",
  "project.update",
  "task.create",
  "task.assign",
];

const ROLE_PERMISSIONS: Record<Role, Action[]> = {
  // Technical platform owner — short-circuited via isSuperAdmin, kept empty here.
  super_admin: [],

  // Executive Overview — agency-wide oversight. Reads everything + may comment/flag.
  // No operational write, no approvals.
  executive: [
    "workspace.read",
    "department.read",
    "subunit.read",
    "member.read",
    "request.read",
    "project.read",
    "task.read",
    "comment.create",
    "lead.read",
    "audit.read",
    "integration.read",
    "report.read", "report.generate",
  ],

  // Operational runner — full control of the agency (was agency_admin + agency_lead).
  admin: [
    "workspace.read", "workspace.create", "workspace.update", "workspace.archive",
    "workspace.invite", "workspace.removeMember", "workspace.changeRole",
    "department.read", "department.create", "department.update", "department.archive",
    "subunit.read", "subunit.create", "subunit.update", "subunit.archive",
    "member.read",
    "request.read", "request.create", "request.update", "request.transition",
    "request.route", "request.approve", "request.reject", "request.delete",
    "project.read", "project.create", "project.update", "project.delete",
    "task.read", "task.create", "task.update", "task.assign", "task.review", "task.delete",
    "comment.create",
    "lead.read", "lead.update", "lead.convert",
    "audit.read",
    "integration.read", "integration.manage",
    "report.read", "report.generate",
  ],

  // Department owner — runs a department and its sub-units (was department_lead + subunit_lead).
  department_lead: [
    "workspace.read",
    "department.read", "department.update",
    "subunit.read", "subunit.create", "subunit.update", "subunit.archive",
    "member.read",
    "request.read", "request.update", "request.transition", "request.route",
    "project.read", "project.create", "project.update",
    "task.read", "task.create", "task.update", "task.assign", "task.review",
    "comment.create",
    "report.read", "report.generate",
  ],

  // Does the work. Project-management actions come from the canManageProjects capability,
  // not from this base role (absorbs the old project_manager via that toggle).
  member: [
    "workspace.read",
    "department.read",
    "subunit.read",
    "member.read",
    "request.read", "request.create",
    "project.read",
    "task.read", "task.update", "task.submitCompletion",
    "comment.create",
  ],

  // Client — submits and tracks their org's requests (was requester_admin + requester_member).
  client: [
    "workspace.read", "workspace.invite",
    "request.read", "request.create", "request.update",
    "project.read",
  ],

  // Client viewer — read-only stakeholder (was requester_observer).
  client_viewer: [
    "workspace.read",
    "request.read",
    "project.read",
  ],
};

export function can(ctx: AuthContext, action: Action): boolean {
  if (ctx.isSuperAdmin) return true;
  if (ctx.roles.some((role) => ROLE_PERMISSIONS[role]?.includes(action))) return true;
  if (ctx.capabilities?.canManageProjects && CAN_MANAGE_PROJECTS_ACTIONS.includes(action)) {
    return true;
  }
  return false;
}

export function requirePermission(ctx: AuthContext, action: Action): void {
  if (!can(ctx, action)) {
    throw new Error(`Forbidden: missing permission "${action}".`);
  }
}
