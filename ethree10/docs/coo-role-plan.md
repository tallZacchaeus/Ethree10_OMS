# Plan — Chief Operating Officer role

**Status:** step 1 complete (role, permissions, migration, seed). Steps 2–5 outstanding — see §6.
**Date:** 2026-08-12, updated 2026-08-13

Adds a seventh operational role, `chief_operating_officer` (COO): below the Chief
Executive, above every other role, excluding `super_admin`.

---

## 1. Decisions this plan assumes

| Decision | Choice |
|---|---|
| Enum value | `chief_operating_officer`, labelled "Chief Operating Officer" |
| Operational scope | Superset of `agency_admin`, plus the CEO's agency-wide read |
| Budget approval | **Delegated only** — may approve while a CEO delegation is active, never by role alone |
| Read scope | Agency-wide — added to `AGENCY_WIDE_ROLES` |
| Weekly/monthly reports | COO is copied on every finalized report, as the CEO is |
| Delegation window | 90 days maximum, then renewal |
| Concurrent delegations | One at a time — granting revokes any existing delegation |

All decisions are settled; there are no open questions blocking implementation.

---

## 2. The constraint that shapes everything

**This codebase has no role hierarchy.** `ROLE_PERMISSIONS` in
`server/auth/permissions.ts` is a flat `Record<Role, Action[]>`. Nothing ranks
roles; `can()` asks only "does any of this user's roles list this action". There
is no inheritance and no precedence.

So "higher than any other role" cannot be declared — it has to be *constructed*
as a permission superset, and it will silently stop being true the moment
someone adds an action to another role and forgets the COO. Section 8 covers
guarding that.

Second constraint, from `GOVERNANCE-AND-JOURNEYS.md`:

> The one exception is money, where the executive is the *only* approver. (line 81)
> Only `chief_executive` may move `submitted → approved | rejected`. (line 140)

`scripts/verify-governance.ts` asserts this against a live database. A COO that
could approve budgets by role alone would break a documented, tested invariant —
which is exactly why the delegated model was chosen. **The invariant survives
unchanged:** no role other than `chief_executive` ever holds `budget.approve` in
`ROLE_PERMISSIONS`. Delegation grants it per-user, time-boxed and audited.

---

## 3. Permission set

**Implementation note (2026-08-13).** The original plan assumed a union of
`agency_admin` and the Chief Executive's read surface would produce a superset.
It did not: `agency_admin` already held every read the Chief Executive has
except `budget.approve`, so the union was *identical* to `agency_admin` — 53
actions each, zero difference. The COO would have outranked nobody.

`agency_admin` was therefore narrowed. These eight actions are now COO-only:

```
organization.archive              retiring a client relationship
team.create / team.archive        creating or retiring a branch
subunit.archive                   retiring a department
request.delete / project.delete   irreversible; the system prefers
task.delete                       cancelling and superseding
integration.manage                moves agency data outside the system
```

`agency_admin` keeps every day-to-day power: inviting and managing people,
services, skills, routing, assignment, review, and creating organisations,
departments, projects and tasks. It also keeps `integration.read`.

`tests/unit/authorization.test.ts` asserts both halves — that the COO holds
everything `agency_admin`, `branch_head` and `department_lead` hold, and that
the difference over `agency_admin` is exactly these eight.

**Deliberately excluded:**

| Action | Why |
|---|---|
| `budget.approve` | Delegation only. Never in `ROLE_PERMISSIONS`. |
| `payment.confirm` | Finance moves money. A COO approving (when delegated) and confirming the same payment destroys the audit chain. |
| `receipt.issue` | Same reason; receipts are only ever created by `confirmInvoicePayment`. |
| `expense.pay` | Same reason. |
| `invoice.manage` | Finance's surface. COO reads invoices, does not issue them. |

Net effect: the COO outranks every non-CEO role on **operations and oversight**,
and deliberately does not touch **money execution**. That is a real limit, and
it is the correct one — the alternative reintroduces the exact bypass the
governance model exists to prevent.

**Read scope is agency-wide.** The COO joins `AGENCY_WIDE_ROLES`, which
`hasAgencyWideScope()` uses to widen queries in 11 files (requests, invoices,
receipts, reports, search, dashboard, projects, the report PDF route). Without
it the COO would hold `invoice.read` yet see only their own branch's invoices —
narrower data than the `agency_admin` they outrank, which would make the
superset claim false in practice even while true in the permission table.

---

## 4. Delegated budget approval

### 4.1 Data model

New table. Migration via `pnpm db:migrate` (never `db push` — see CLAUDE.md).

```prisma
model BudgetApprovalDelegation {
  id           String    @id @default(cuid())
  /// The Chief Executive granting the authority.
  grantedById  String
  grantedBy    User      @relation("DelegationGrantedBy", fields: [grantedById], references: [id])
  /// The user receiving it — in practice the COO, but not enforced by role so
  /// the CEO can delegate to whoever is actually covering.
  delegateId   String
  delegate     User      @relation("DelegationDelegate", fields: [delegateId], references: [id])
  reason       String
  startsAt     DateTime  @default(now())
  /// Required. An open-ended delegation is a second permanent approver by the
  /// back door, which is what this design exists to avoid.
  expiresAt    DateTime
  revokedAt    DateTime?
  revokedById  String?
  createdAt    DateTime  @default(now())

  @@index([delegateId, expiresAt])
}
```

`expiresAt` is **not** optional and is capped at **90 days** in the service.
Renewal is a deliberate act, not a default.

**One active delegation at a time.** Granting a new one revokes any existing
active delegation in the same transaction, stamping `revokedAt` and
`revokedById` rather than deleting the row. History is preserved, and "who could
approve on date X" is answerable from a single row — which is the question an
auditor actually asks.

### 4.2 Resolving it

`getAgencyAuthContext` in `server/services/agency.ts` currently reads
memberships only. Extend `AuthContext`:

```ts
export interface AuthContext {
  isSuperAdmin: boolean;
  roles: Role[];
  capabilities?: Capabilities;
  /** Actions granted by an active delegation rather than by role. */
  delegatedActions?: Action[];
}
```

`can()` gains one clause, after the role and capability checks:

```ts
if (ctx.delegatedActions?.includes(action)) return true;
```

An active delegation is: `revokedAt: null`, `startsAt <= now`, `expiresAt > now`.
This adds one query per auth context resolution — acceptable, and it can be
skipped entirely unless the user holds a role that can ever be delegated to.

### 4.3 Guard rails

1. **Self-approval** — already blocked in `BudgetService.decide` via the
   `submittedById === actorId` check. Unchanged, and it now matters more.
2. **Separation of duties** — add `["chief_operating_officer", "finance_manager"]`
   to `MUTUALLY_EXCLUSIVE_ROLES`. A delegated approver who can also confirm
   payment is precisely the combination `assertSeparationOfDuties` exists to stop.
3. **Only a CEO may grant** — `budget.delegate` as a new `Action`, held solely by
   `chief_executive`.
4. **Audit everything** — `AuditService.log` on grant, revoke, expiry-at-use, and
   on any approval made under delegation. Budget decisions should record *that*
   they were made under delegation, so an auditor reading `BudgetDecision` sees
   it without cross-referencing.

### 4.4 Notifications

`BudgetService.submit` notifies every `chief_executive`. It must also notify the
active delegate, or a submission during the CEO's absence sits unseen — the
whole point of the feature. Note this is the same recipient-narrowness bug fixed
for client replies in PR #18; the pattern is worth reusing rather than
rediscovering.

**Expiry visibility.** With a 90-day cap, a delegation can outlive the absence
that justified it by a wide margin, so it should not be able to sit unnoticed:

- notify the CEO and the delegate **7 days before** expiry, and again on expiry
- show the active delegation, its reason and its end date on `/budgets` for both
  parties — not buried in a settings screen
- include active delegations in the weekly report to the CEO, so a forgotten one
  surfaces on a regular cadence rather than only at expiry

This is the main safeguard for the longer window: the delegation is loud while
it is live, so revoking early is the easy path.

---

## 5. Files to change

Grounded in an actual scan — 23 files reference roles today.

### Schema and data
- `prisma/schema.prisma` — add enum value; add `BudgetApprovalDelegation`; back-relations on `User`
- `prisma/migrations/` — one migration, generated with `pnpm db:migrate`
- `prisma/seed.ts` — a COO demo user, so the role is exercised locally

### Authorization core
- `server/auth/permissions.ts` — `chief_operating_officer` entry; `budget.delegate` action; `MUTUALLY_EXCLUSIVE_ROLES`; `delegatedActions` in `can()`
- `server/auth/role-groups.ts` — add to `STAFF_ROLES`, `AGENCY_WIDE_ROLES`, `DELIVERY_LEAD_ROLES`, `BRANCH_LEAD_ROLES`, `REQUEST_ACCESS_ROLES`; `ROLE_LABELS`; `ROLE_DESCRIPTIONS`
- `server/services/agency.ts` — resolve active delegations into the auth context

### Services and routers
- `server/services/budget.ts` — notify delegates on submit; record delegation on decisions
- `server/services/delegation.ts` — **new**: grant, revoke, list, with audit
- `server/trpc/routers/budgets.ts` — delegation endpoints
- `server/trpc/routers/execution.ts:22` — hardcoded role array, add COO
- `server/services/report.ts:456` — CEO-only recipient query; add the COO so it is copied on every finalized report. Also the natural place to surface an active delegation to the CEO (§4.4)
- `server/trpc/routers/setup.ts:23` — hardcoded list of all seven roles

### Route guards — each is a hardcoded array
- `app/(app)/agency|audit|members|organizations|leads|invoices|receipts/layout.tsx` — add COO where agency-wide
- `app/(app)/budgets/layout.tsx` — **cannot stay role-based.** Currently
  `requirePageRole(["chief_executive"])`. Needs an action-aware variant
  (`requirePageAction("budget.approve")`) so a delegated COO reaches the page and
  a non-delegated one does not.

### UI
- `app/(app)/members/page.tsx:50-55` — role picker is a hardcoded array; add COO
- `components/layout/app-sidebar.tsx` — nav gating; Budget Approvals must follow the action, not the role
- `lib/dashboard.ts:11` — `isExecutive` check
- `lib/help-content.ts` — role guidance entry

### Tests and verification
- `tests/unit/authorization.test.ts` — COO permission surface; delegation grants and expires
- `tests/integration/governance.test.ts` — delegated approval works; expired/revoked does not
- `scripts/verify-governance.ts` — extend; assert `budget.approve` is still role-held by CEO alone

### Docs
- `GOVERNANCE-AND-JOURNEYS.md` — role table, journeys, the access matrix at line ~403
- `CLAUDE.md` — the seven-role table becomes eight

---

## 6. Sequencing

Each step leaves the app working and testable.

1. **Role, no delegation.** Enum, migration, permissions, role groups, seed.
   COO is a full operational superset with no budget powers. Ship and verify.
2. **Reachability.** Route guards, nav, role picker, dashboard, help. A real COO
   login can now reach everything it should. Verify in the browser per role.
3. **Delegation model.** Table, service, audit, `AuthContext` wiring, `can()`.
   No UI yet — cover with integration tests.
4. **Delegation UI.** CEO grants/revokes from `/budgets`; banner for the active
   delegate; `requirePageAction` for the budgets route.
5. **Docs and governance verification.** Update the contract docs and extend
   `verify-governance.ts`.

Steps 1–2 deliver the role the user asked for. Steps 3–5 deliver the delegated
approval, and can land as a separate PR if the role is wanted sooner.

---

## 7. Migration and rollout notes

- Postgres allows `ALTER TYPE ... ADD VALUE`, so adding the enum value is
  non-destructive and needs no backfill — no existing row changes.
- The migration history was baselined on 2026-08-09. Use `pnpm db:migrate` to
  generate, and `pnpm db:deploy` on deploy. Never `db push` against a shared DB.
- Adding an enum value and using it in the same transaction fails on older
  Postgres. Keep the enum change in its own migration, separate from any
  migration that inserts a COO membership.
- `pnpm db:generate` after the schema change, or TypeScript will not compile.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| **"Higher than everyone" silently decays** — a new action added to `agency_admin` and not to COO | A unit test asserting COO's action set is a strict superset of every non-CEO role. This is the single most valuable test here; it turns an English claim into an enforced one. |
| **Delegation becomes permanent** — renewed indefinitely, or a 90-day grant outlives the absence that justified it | Mandatory `expiresAt` capped at 90 days; one active delegation at a time; expiry warning at 7 days; active delegation shown on `/budgets` and listed in the CEO's weekly report (§4.4). The longer window makes this visibility load-bearing, not optional. |
| **Hardcoded role arrays missed** — at least 8 route guards and several routers inline them rather than using `role-groups.ts` | Grep `chief_executive` as the checklist; move each to a named group while touching it. CLAUDE.md already warns copy-pasted arrays are how the previous model drifted apart. |
| **Separation of duties hole** — COO holds `finance_manager` too, approves under delegation then confirms the payment | `MUTUALLY_EXCLUSIVE_ROLES` entry, enforced by `assertSeparationOfDuties` at membership write |
| **Budget page guard** — role-based guard would either lock out a delegated COO or admit an undelegated one | `requirePageAction` instead of `requirePageRole`; test both states |

---

## 9. Settled questions

Recorded so the reasoning survives the decision.

1. **Agency-wide read — yes.** The COO joins `AGENCY_WIDE_ROLES` (§3). Anything
   else gives them permissions they cannot exercise on data they cannot see.
2. **Weekly and monthly reports — copied.** The COO receives every finalized
   report, as the CEO does (`report.ts:456`). Roughly 15–20 notifications a week
   at current headcount. If that proves noisy in practice, the narrower option
   was to copy only branch and department reports and drop per-member ones —
   worth revisiting after a few weeks of real use rather than pre-emptively.
3. **Delegation window — 90 days.** Covers extended leave without repeated
   renewals. The trade is that a forgotten delegation stays live for a quarter,
   which is why the expiry warnings and `/budgets` visibility in §4.4 are part
   of the build rather than a nice-to-have.
4. **One active delegation at a time.** Granting revokes the previous one in the
   same transaction. Revoked rows are kept, so the history stays auditable.
