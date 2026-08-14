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
  | "member.updateSkills"
  // The skill taxonomy itself — the shared vocabulary the assignee suggester
  // matches against. Editing it changes what every branch can pick from, so it
  // sits with agency configuration rather than with delivery.
  | "skill.manage"
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
  /// Propose an assignee. The proposal only becomes real once someone holding
  /// task.assignmentApprove decides on it.
  | "task.assign"
  /// Decide a proposed assignment. Held by branch leads — the branch head must
  /// approve work given to their people. See docs/service-assignment-plan.md.
  | "task.assignmentApprove"
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
  | "receipt.issue"
  // ── Money governance ─────────────────────────────────────────────────────
  // Budgets gate all spending. Only the Chief Executive may decide one, and
  // only Finance may confirm that money actually moved.
  | "budget.read"
  | "budget.submit"
  | "budget.approve"
  /// Grant another user time-boxed budget.approve. Chief Executive only.
  | "budget.delegate"
  | "payment.confirm"
  | "expense.read"
  | "expense.request"
  | "expense.pay";

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
  /**
   * Actions granted by an active delegation rather than by a role. Kept separate
   * from `roles` on purpose: the role map stays the single answer to "what may
   * this role do", and a delegation is visible as the exception it is.
   */
  delegatedActions?: Action[];
}

/** Actions unlocked by the `canManageProjects` capability toggle. */
const CAN_MANAGE_PROJECTS_ACTIONS: Action[] = [
  "project.create",
  "project.update",
  "task.create",
  "task.assign",
];

/**
 * Exported so tests can assert relationships between roles directly rather than
 * against a hardcoded list of actions — a list in a test cannot catch an action
 * that did not exist when the test was written, which is exactly the drift the
 * Chief Operating Officer superset check exists to prevent.
 */
export const ROLE_PERMISSIONS: Record<Role, Action[]> = {
  // Technical platform owner — short-circuited via isSuperAdmin, kept empty here.
  super_admin: [],

  // ── Chief Executive ──────────────────────────────────────────────────────
  // The overall head. Sees the entire agency and is the ONLY role that may
  // approve a project budget. Deliberately has no delivery write power: it
  // cannot route, assign, create projects or tasks, or transition requests,
  // because each branch head knows their own people best. Its non-financial
  // voice is `comment.create` — notes on requests, projects and tasks.
  //
  // It also cannot confirm payments. Approving the money and confirming the
  // money moved must be two different people (see assertSeparationOfDuties).
  chief_executive: [
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
    "invoice.read", "receipt.read",
    "budget.read", "budget.approve", "budget.delegate",
    "expense.read",
  ],

  // ── Finance Manager ──────────────────────────────────────────────────────
  // Executes money movement against budgets the Chief Executive approved.
  // Issues invoices, confirms funds received, issues receipts, and pays
  // approved expenses. Cannot approve a budget — only spend within one.
  finance_manager: [
    "organization.read",
    "team.read",
    "subunit.read",
    "member.read",
    "service.read",
    "request.read",
    "project.read",
    "task.read",
    "comment.create",
    "lead.read", "lead.update",
    "audit.read",
    "report.read", "report.generate",
    "invoice.read", "invoice.manage",
    "receipt.read", "receipt.issue",
    "payment.confirm",
    "budget.read",
    "expense.read", "expense.pay",
  ],

  // ── Chief Operating Officer ──────────────────────────────────────────────
  // Below the Chief Executive, above every other role. Deliberately built as a
  // strict superset of `agency_admin` plus the Chief Executive's read surface —
  // there is no role hierarchy in this codebase, so seniority only exists as
  // the union of actions below. `tests/unit/authorization.test.ts` asserts the
  // superset property; if you add an action to another role, that test is what
  // will tell you this one needs it too.
  //
  // Excluded on purpose, and not an oversight:
  //   budget.approve   — granted per-user by a time-boxed delegation from the
  //                      Chief Executive, never by role. Keeps `chief_executive`
  //                      the only role-level approver, which the governance doc
  //                      states and scripts/verify-governance.ts asserts.
  //   payment.confirm  — a delegated approver who could also confirm the payment
  //   receipt.issue      they approved is exactly the bypass separation of duties
  //   expense.pay        exists to prevent.
  //   invoice.manage   — Finance's surface. The COO reads invoices, never issues.
  //
  // See docs/coo-role-plan.md.
  chief_operating_officer: [
    "organization.read", "organization.create", "organization.update", "organization.archive",
    "organization.invite", "organization.removeMember", "organization.changeRole",
    "team.read", "team.create", "team.update", "team.archive",
    "subunit.read", "subunit.create", "subunit.update", "subunit.archive",
    "member.read", "member.updateSkills",
    "skill.manage",
    "service.read", "service.manage",
    "request.read", "request.create", "request.update", "request.transition",
    "request.route", "request.approve", "request.reject", "request.delete",
    "project.read", "project.create", "project.update", "project.delete",
    "task.read", "task.create", "task.update", "task.assign", "task.review", "task.assignmentApprove", "task.delete",
    "comment.create",
    "lead.read", "lead.update", "lead.convert",
    "audit.read",
    "integration.read", "integration.manage",
    "report.read", "report.generate",
    "invoice.read", "receipt.read",
    "budget.read", "budget.submit",
    "expense.read", "expense.request",
  ],

  // ── Agency Admin ─────────────────────────────────────────────────────────
  // Runs agency operations and configuration: people, services, skills and
  // delivery. Explicitly excluded from budget approval and payment confirmation
  // so that operational power never becomes money power.
  //
  // Reshaping the agency and destroying records belong to the COO, not here.
  // Specifically NOT granted, and each is deliberate:
  //   team.create / team.archive   — creating or retiring a branch is a
  //   subunit.archive                structural decision above day-to-day ops
  //   organization.archive         — retiring a client relationship
  //   request/project/task.delete  — irreversible; the system prefers
  //                                  cancelling and superseding over deleting
  //   integration.manage           — connecting external systems moves agency
  //                                  data outside it
  // The Admin can still create departments, update anything, invite and manage
  // people, run the service catalogue, and route, assign and review work.
  agency_admin: [
    "organization.read", "organization.create", "organization.update",
    "organization.invite", "organization.removeMember", "organization.changeRole",
    "team.read", "team.update",
    "subunit.read", "subunit.create", "subunit.update",
    "member.read", "member.updateSkills",
    "skill.manage",
    "service.read", "service.manage",
    "request.read", "request.create", "request.update", "request.transition",
    "request.route", "request.approve", "request.reject",
    "project.read", "project.create", "project.update",
    "task.read", "task.create", "task.update", "task.assign", "task.review", "task.assignmentApprove",
    "comment.create",
    "lead.read", "lead.update", "lead.convert",
    "audit.read",
    "integration.read",
    "report.read", "report.generate",
    "invoice.read", "receipt.read",
    "budget.read", "budget.submit",
    "expense.read", "expense.request",
  ],

  // ── Branch Head ──────────────────────────────────────────────────────────
  // Heads one branch (a `Team` row: Digital Media or Tech & Product) and the
  // departments inside it. Full delivery authority within the branch, and may
  // submit a budget for the Chief Executive to approve — but never approve it.
  branch_head: [
    "organization.read",
    "team.read", "team.update",
    "subunit.read", "subunit.create", "subunit.update", "subunit.archive",
    "member.read", "member.updateSkills",
    "service.read", "service.manage",
    "request.read", "request.update", "request.transition", "request.route",
    "request.approve", "request.reject",
    "project.read", "project.create", "project.update",
    "task.read", "task.create", "task.update", "task.assign", "task.review", "task.assignmentApprove",
    "comment.create",
    "report.read", "report.generate",
    "budget.read", "budget.submit",
    "expense.read", "expense.request",
  ],

  // ── Department Lead ──────────────────────────────────────────────────────
  // Leads one department (a `SubUnit`) inside a branch. Runs delivery for that
  // department — assigns and reviews work — but does not restructure the branch,
  // manage the service catalogue, or touch money beyond requesting spend.
  department_lead: [
    "organization.read",
    "team.read",
    "subunit.read", "subunit.update",
    "member.read", "member.updateSkills",
    "service.read",
    "request.read", "request.update", "request.transition",
    "project.read", "project.create", "project.update",
    "task.read", "task.create", "task.update", "task.assign", "task.review",
    "comment.create",
    "report.read", "report.generate",
    "budget.read",
    "expense.read", "expense.request",
  ],

  // ── Team Member ──────────────────────────────────────────────────────────
  // Delivers the work. Project-management actions come from the
  // canManageProjects capability toggle, not from this base role.
  //
  // May raise a request, but not read the pipeline. Intake, triage, client
  // correspondence and budget estimates are lead territory; a team member sees
  // the work that came out of it as tasks, not the raw client brief. Granting
  // `request.read` here made every request in the member's branch readable by
  // everyone in it. Their own submissions stay visible via `myRequests` and
  // the owner escape in `assertCanReadRequest`.
  team_member: [
    "organization.read",
    "team.read",
    "subunit.read",
    "member.read",
    "service.read",
    "request.create",
    "project.read",
    "task.read", "task.update", "task.submitCompletion",
    "comment.create",
  ],

};

/**
 * Roles that must never be held by the same person. Approving money and moving
 * money are separate duties; combining them makes the approval chain
 * unverifiable in an audit.
 */
export const MUTUALLY_EXCLUSIVE_ROLES: ReadonlyArray<readonly [Role, Role]> = [
  ["chief_executive", "finance_manager"],
  // The COO can be delegated budget approval by the Chief Executive. Someone
  // holding Finance as well could approve a budget under delegation and then
  // confirm the payment against it — the same hole the pair above closes.
  ["chief_operating_officer", "finance_manager"],
];

/**
 * Throws if the resulting role set would violate separation of duties.
 * Call before creating or updating any membership.
 */
export function assertSeparationOfDuties(roles: Role[]): void {
  for (const [a, b] of MUTUALLY_EXCLUSIVE_ROLES) {
    if (roles.includes(a) && roles.includes(b)) {
      throw new Error(
        `Separation of duties: a user cannot hold both "${a}" and "${b}". ` +
          `Approving a budget and confirming its payment must be different people.`,
      );
    }
  }
}

export function can(ctx: AuthContext, action: Action): boolean {
  if (ctx.isSuperAdmin) return true;
  if (ctx.roles.some((role) => ROLE_PERMISSIONS[role]?.includes(action))) return true;
  // Time-boxed grants resolved from BudgetApprovalDelegation. Checked last so a
  // delegation can only ever add, never mask a role decision.
  if (ctx.delegatedActions?.includes(action)) return true;
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
