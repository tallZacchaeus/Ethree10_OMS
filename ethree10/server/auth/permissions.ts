import type { Role } from "@prisma/client";

export type Action =
  | "organization.read"
  | "organization.create"
  | "organization.update"
  | "organization.archive"
  | "organization.invite"
  | "organization.removeMember"
  | "organization.changeRole"
  | "team.read"
  | "team.create"
  | "team.update"
  | "team.archive"
  | "team.delete"
  | "subunit.read"
  | "subunit.create"
  | "subunit.update"
  | "subunit.archive"
  | "member.read"
  | "service.read"
  | "service.manage"
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
  | "report.generate"
  | "invoice.read"
  | "invoice.manage"
  | "receipt.read"
  | "receipt.issue";

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
  finance_admin: [
    "organization.read",
    "team.read",
    "subunit.read",
    "member.read",
    "service.read",
    "request.read",
    "project.read",
    "task.read",
    "comment.create",
    "lead.read",
    "audit.read",
    "integration.read",
    "report.read", "report.generate",
    "invoice.read", "invoice.manage", "receipt.read", "receipt.issue",
  ],

  // Operational runner — full control of the agency (was agency_admin + agency_lead).
  agency_admin: [
    "organization.read", "organization.create", "organization.update", "organization.archive",
    "organization.invite", "organization.removeMember", "organization.changeRole",
    "team.read", "team.create", "team.update", "team.archive",
    "subunit.read", "subunit.create", "subunit.update", "subunit.archive",
    "member.read",
    "service.read", "service.manage",
    "request.read", "request.create", "request.update", "request.transition",
    "request.route", "request.approve", "request.reject", "request.delete",
    "project.read", "project.create", "project.update", "project.delete",
    "task.read", "task.create", "task.update", "task.assign", "task.review", "task.delete",
    "comment.create",
    "lead.read", "lead.update", "lead.convert",
    "audit.read",
    "integration.read", "integration.manage",
    "report.read", "report.generate",
    "invoice.read", "invoice.manage", "receipt.read", "receipt.issue",
  ],

  // Department owner — runs a department and its sub-units (was team_head + subunit_lead).
  team_head: [
    "organization.read",
    "team.read", "team.update",
    "subunit.read", "subunit.create", "subunit.update", "subunit.archive",
    "member.read",
    "service.read", "service.manage",
    "request.read", "request.update", "request.transition", "request.route", "request.approve", "request.reject",
    "project.read", "project.create", "project.update",
    "task.read", "task.create", "task.update", "task.assign", "task.review",
    "comment.create",
    "report.read", "report.generate",
  ],

  // Does the work. Project-management actions come from the canManageProjects capability,
  // not from this base role (absorbs the old project_manager via that toggle).
  team_member: [
    "organization.read",
    "team.read",
    "subunit.read",
    "member.read",
    "service.read",
    "request.read", "request.create",
    "project.read",
    "task.read", "task.update", "task.submitCompletion",
    "comment.create",
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
