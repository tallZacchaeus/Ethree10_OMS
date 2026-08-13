import type { Role } from "@prisma/client";

/**
 * Named role groups. Defined once so page guards, nav gating and routers cannot
 * drift apart — the previous model had these arrays copy-pasted across 20 files,
 * which is how the old `finance_admin` ended up meaning three different things.
 *
 * Org vocabulary: a `Team` row is a **Branch** (Digital Media, Tech & Product);
 * a `SubUnit` row is a **Department** inside a branch.
 */

/** Every internal staff role. Everyone who logs in is one of these. */
export const STAFF_ROLES: Role[] = [
  "chief_executive",
  "chief_operating_officer",
  "agency_admin",
  "finance_manager",
  "branch_head",
  "department_lead",
  "team_member",
];

/** Can see the whole agency, across every branch. Read scope, not write scope. */
export const AGENCY_WIDE_ROLES: Role[] = [
  "chief_executive",
  "chief_operating_officer",
  "agency_admin",
  "finance_manager",
];

/** Runs delivery: routes work, assigns people, reviews output. */
export const DELIVERY_LEAD_ROLES: Role[] = [
  "chief_operating_officer",
  "agency_admin",
  "branch_head",
  "department_lead",
];

/**
 * May read the whole request pipeline, not just their own submissions. Mirrors
 * exactly which roles hold `request.read` in ROLE_PERMISSIONS — the screens and
 * the router must agree, or a page renders a query the server then rejects.
 */
export const REQUEST_ACCESS_ROLES: Role[] = [
  "chief_executive",
  "chief_operating_officer",
  "agency_admin",
  "finance_manager",
  "branch_head",
  "department_lead",
];

/** Leads a branch or the whole agency — may restructure teams and services. */
export const BRANCH_LEAD_ROLES: Role[] = ["chief_operating_officer", "agency_admin", "branch_head"];

/**
 * Administers the agency itself — integrations, the marketing site, and adding
 * or removing people. The COO is here because `integration.manage` is COO-only;
 * without it the one role that can connect an integration could not reach the
 * page, and because it outranks the Agency Admin it must also be able to invite.
 */
export const AGENCY_CONFIG_ROLES: Role[] = ["chief_operating_officer", "agency_admin"];

/**
 * May trigger agency-wide report generation. Mirrors `report.generate`, minus the
 * Chief Executive — reports are an operational chore, and the executive receives
 * every finalized one anyway.
 */
export const REPORT_GENERATOR_ROLES: Role[] = [
  "chief_operating_officer",
  "agency_admin",
  "finance_manager",
  "branch_head",
];

/** Touches money. Deliberately excludes agency_admin and the Chief Executive. */
export const FINANCE_ROLES: Role[] = ["finance_manager"];

/** May approve a project budget. Exactly one role, by design. */
export const BUDGET_APPROVER_ROLES: Role[] = ["chief_executive"];

/** Human-readable labels. The single source of truth for role names in the UI. */
export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super Admin",
  chief_executive: "Chief Executive",
  chief_operating_officer: "Chief Operating Officer",
  agency_admin: "Agency Admin",
  finance_manager: "Finance Manager",
  branch_head: "Branch Head",
  department_lead: "Department Lead",
  team_member: "Team Member",
};

/** One-line description of what each role is for, shown on the members screen. */
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  super_admin: "Technical platform owner. Full access.",
  chief_executive:
    "Oversees the whole agency and approves project budgets. Views everything; comments but does not assign or route.",
  chief_operating_officer:
    "Runs the agency day to day, second to the Chief Executive. Full operations and agency-wide visibility. Does not approve budgets unless the Chief Executive delegates it, and never confirms payments.",
  agency_admin:
    "Runs agency operations, people and configuration. No budget approval or payments.",
  finance_manager:
    "Issues invoices, confirms payments received and issues receipts. Cannot approve budgets.",
  branch_head:
    "Heads a branch (Digital Media or Tech & Product) and its departments. Routes, assigns and reviews work.",
  department_lead:
    "Leads a department inside a branch. Assigns and reviews that department's work.",
  team_member: "Delivers assigned work.",
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}

interface RoleBearer {
  isSuperAdmin: boolean;
  roles: Role[];
}

/** True when the user may read across every branch (not write — read). */
export function hasAgencyWideScope(ctx: RoleBearer): boolean {
  return ctx.isSuperAdmin || ctx.roles.some((role) => AGENCY_WIDE_ROLES.includes(role));
}

/** True when the user leads a branch or the agency. */
export function isBranchLead(ctx: RoleBearer): boolean {
  return ctx.isSuperAdmin || ctx.roles.some((role) => BRANCH_LEAD_ROLES.includes(role));
}

/** True when the user may move money. */
export function isFinance(ctx: RoleBearer): boolean {
  return ctx.isSuperAdmin || ctx.roles.some((role) => FINANCE_ROLES.includes(role));
}

/** True when the user may approve a project budget. */
export function isBudgetApprover(ctx: RoleBearer): boolean {
  return ctx.isSuperAdmin || ctx.roles.some((role) => BUDGET_APPROVER_ROLES.includes(role));
}
