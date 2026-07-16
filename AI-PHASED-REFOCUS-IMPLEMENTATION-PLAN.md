# Ethree10 OMS — AI Phased Refocus Implementation Plan

**Status:** Proposed execution brief  
**Prepared:** 16 July 2026  
**Audience:** AI coding agents and supervising engineers  
**Application state:** Deployed, but not yet in operational use  
**Execution rule:** Complete one phase at a time. Stop after each phase and obtain approval before proceeding.

## 1. Objective

Refocus the deployed Ethree10 OMS around the agency's actual operating model:

- One Ethree10 agency
- Two teams: Product Development and Brands & Communications
- Organizations submit requests for solutions
- Requests route to the appropriate team head
- Team heads accept, plan, and assign work to suitable personnel
- Contributors execute tasks and submit deliverables for review
- Team heads vet work before client delivery
- Requesters are notified, review the delivery, and accept or request changes
- Weekly and monthly reports cover agency, team, organization, and individual contributions

Do not rewrite the application. Preserve useful existing functionality and reshape it incrementally.

## 2. Required reading

Read these files completely before making changes:

1. `PRODUCT-RECOMMENDATIONS.md` — product model and operating rules
2. `APPLICATION-PAGE-MAP.md` — target pages, routes, priorities, and navigation
3. `20-Workspace-Removal-Plan.md` — existing organization migration analysis
4. `19-Link-Based-Client-Tracking.md` — current tracking-link design
5. `ethree10/README.md` — runnable application and commands
6. `ethree10/DOCUMENTATION_MAINTENANCE.md` — documentation requirements
7. `ethree10/prisma/schema.prisma` — current data model
8. `ethree10/server/auth/permissions.ts` — authorization model
9. `ethree10/server/trpc/routers/_app.ts` — server module composition
10. `ethree10/package.json` — canonical scripts and dependencies

Treat older numbered specifications and `IMPLEMENTATION-PLAN.md` as historical context where they conflict with the two new product documents.

## 3. Repository and application facts

- Repository root: `Ethree10_OMS/`
- Runnable application: `Ethree10_OMS/ethree10/`
- Package manager: `pnpm`
- Current architecture: Next.js App Router, TypeScript, tRPC, Prisma/PostgreSQL, Auth.js, Redis/BullMQ, S3-compatible storage, Resend, Tailwind/Radix, Vitest, and Playwright
- A production deployment already exists, but the application has not been adopted by operational users.
- The current local branch and working tree contain workspace-to-organization and public-tracking work that may not be committed or merged.
- Commercial modules such as invoices, receipts, payments, sponsorships, and integrations already exist. Preserve them unless a verified defect requires changes.

## 4. Non-negotiable safety rules

1. Never expose, print, commit, or replace production secrets.
2. Never assume the production database is empty because the application has not been used.
3. Inspect production record counts and create a verified backup before any schema or data operation.
4. Never run `prisma db push --accept-data-loss`, `prisma migrate reset`, destructive SQL, or seed scripts against production without explicit human approval.
5. Prefer reviewed Prisma migrations and reversible data-migration scripts over direct schema pushes.
6. Never make production the first environment where a migration is tested.
7. Preserve the current deployment and database until staging acceptance is complete.
8. Work on a feature branch; do not push directly to `main`.
9. Do not combine architecture migration, framework upgrades, and new workflow features in one pull request.
10. Add tests for every authorization boundary and business-state transition changed.
11. Do not add new product modules outside the approved page map.
12. Do not delete working billing or integration features merely because they are secondary.
13. After every phase, update documentation and report actual verification results.

## 5. Production-data strategy

Because the app is deployed but unused, there are two valid strategies. The agent must not choose silently.

### Strategy A — Clean production baseline

Use only if all of the following are verified and approved:

- No real organization, request, project, financial, audit, or staff activity must be retained
- A full production backup has been created and restoration tested
- The owner explicitly authorizes resetting application data
- Production credentials and infrastructure configuration will remain intact

If approved, apply the final schema to an empty database, seed only the two teams and required administrator records, and retain the backup for rollback.

### Strategy B — In-place migration

Use if any production records must be preserved or the owner does not explicitly authorize a reset:

- Create forward-only schema migrations
- Create an idempotent data-migration script
- Produce before/after record counts
- Preserve primary identifiers and audit history
- Validate organization ownership and staff membership after migration
- Provide and test a rollback procedure

Default to Strategy B when uncertain.

## 6. Standard verification

Run commands from `ethree10/` unless stated otherwise.

```bash
pnpm install
pnpm db:generate
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Run integration and E2E suites when the required services are available:

```bash
pnpm test:integration
pnpm test:e2e
```

A command passes only when it finishes with exit code 0. Record failures and fixes; do not report a timed-out or interrupted command as passing.

## 7. Required phase report format

At the end of every phase, stop and report:

- Summary of changes
- Files and migrations changed
- Product decisions applied
- Data migrated or reset
- Tests added
- Exact verification commands and results
- Manual scenarios verified
- Security or data-isolation findings
- Known limitations
- Deployment or rollback notes
- Commit(s) created
- Recommendation for the next phase

Do not proceed until the supervising human approves the next phase.

---

# Phase 0 — Recovery, inventory, and baseline

## Goal

Establish a trustworthy source of truth and a reproducible baseline before changing product behavior.

## Tasks

1. Inspect Git state:
   - Current branch and commit
   - Local and remote divergence
   - Uncommitted and untracked files
   - Invalid or duplicate refs, including any `main 2`-style ref
   - Open merge, rebase, or lock state
2. Preserve all uncommitted workspace-to-organization and tracking work before repository repair.
3. Repair invalid Git refs only after showing the exact repair and receiving approval.
4. Fetch the remote and determine which branch contains the most complete valid implementation.
5. Create a new branch such as `codex/ethree10-operating-model` from the approved base.
6. Inventory the deployed environment without changing it:
   - Hosting platform and deployment process
   - Production URL and current commit
   - PostgreSQL version and database host
   - Redis/BullMQ worker deployment
   - Object storage
   - Email provider and webhook endpoints
   - Scheduled jobs
7. Record production table counts without exposing personal or secret data.
8. Create and verify a production backup.
9. Set up a staging environment that mirrors production closely enough to test migrations, workers, emails, storage, and webhooks.
10. Run the standard verification block and record the real baseline.
11. Perform a read-only code audit mapping existing pages, routers, services, models, and tests to `APPLICATION-PAGE-MAP.md`.

## Deliverables

- Clean working branch with preserved prior work
- `docs/current-state-audit.md`
- `docs/production-inventory.md` containing no secrets
- Backup and rollback confirmation
- Page/module gap matrix
- Baseline test report

## Exit criteria

- [ ] Git source of truth is known and healthy
- [ ] Existing local work is preserved
- [ ] Production commit and infrastructure are identified
- [ ] Production record counts are known
- [ ] Backup restoration has been verified
- [ ] Staging is available
- [ ] Baseline validation results are documented
- [ ] Production-data strategy is explicitly approved

---

# Phase 1 — Canonical agency, team, people, and organization model

## Goal

Complete the move from generic workspaces to one Ethree10 agency with two teams and organization-scoped client work.

## Tasks

1. Finalize the schema concepts:
   - Implicit Ethree10 agency
   - `Organization` for requesters/clients
   - `Team` or a clearly renamed/redefined `Department`
   - Two seeded teams: Product Development and Brands & Communications
   - Configurable professional `Position` or equivalent job-title model
   - Staff membership, team membership, and authorization role kept separate
2. Decide whether existing `Department` can cleanly represent `Team`. Prefer a safe rename/migration over parallel duplicate concepts.
3. Retire workspace selection, `x-workspace-id`, browser-stored active workspace, and obsolete scoped-database behavior.
4. Make agency-internal records global and client-owned records organization-scoped.
5. Define the smallest permission roles:
   - Super Admin
   - Agency Executive/Admin
   - Team Head
   - Team Member
   - Finance/Admin if billing requires it
6. Do not encode Product Manager, Designer, Developer, Writer, or Marketer as authorization roles.
7. Implement the approved production-data strategy as a reviewed migration.
8. Update seed data with the two teams, common positions, services, and a development administrator.
9. Update authentication/session context and every affected tRPC procedure.
10. Update navigation and remove obsolete workspace pages and switchers.

## Required tests

- Agency staff can access agency-wide records permitted by role.
- Team heads can manage only their assigned team unless they hold agency authority.
- Team members cannot perform team-head actions.
- Organization A can never read or mutate Organization B's data.
- Staff position changes do not silently change authorization.
- Removed workspace headers or local-storage values cannot alter server scoping.
- Migration preserves or correctly resets data according to the approved strategy.

## Exit criteria

- [ ] No active application path depends on a selectable workspace
- [ ] Both Ethree10 teams are present and manageable
- [ ] Positions and permission roles are separate
- [ ] Organization ownership is enforced server-side
- [ ] Migration succeeds on a production-like database copy
- [ ] Isolation and RBAC tests pass
- [ ] Standard verification passes

---

# Phase 2 — Service catalog, request intake, and routing

## Goal

Make every request complete enough to route, evaluate, and plan.

## Tasks

1. Implement a configurable service catalog grouped by the two teams.
2. Define each service's:
   - Owning team
   - Required brief fields
   - Expected deliverables
   - Default priority/SLA where applicable
   - Required specialist reviews where applicable
3. Update public and internal request forms to capture the approved brief from `PRODUCT-RECOMMENDATIONS.md`.
4. Add organization lookup/create behavior with safe deduplication.
5. Route requests to the correct team head based on service.
6. Support an agency-admin fallback for unclassified or cross-team requests.
7. Implement triage decisions:
   - Request clarification
   - Accept
   - Reject with reason
   - Re-route
8. Preserve a complete status and decision timeline.
9. Notify the requester and responsible team head at appropriate transitions.
10. Add the core pages from the public, request, and team-intake sections of `APPLICATION-PAGE-MAP.md`.

## Required tests

- Service routes to the correct team.
- Unknown service routes to the configured fallback.
- Only authorized heads/admins can accept, reject, or re-route.
- Required brief data is validated on client and server.
- Requester receives only client-safe information.
- Organization deduplication does not merge unrelated organizations.
- Status transitions reject invalid jumps.

## Exit criteria

- [ ] An organization can submit a complete request
- [ ] The correct team head receives it
- [ ] Clarification and acceptance flows work
- [ ] All triage decisions are audited
- [ ] Public and internal request pages match the page map
- [ ] Standard verification passes

---

# Phase 3 — Assignment, execution, workload, and internal review

## Goal

Turn an accepted request into controlled, accountable agency work.

## Tasks

1. Convert an accepted request into a project/job without duplicating organization or brief data.
2. Assign an accountable team head/project owner.
3. Create tasks with:
   - One or more contributors where appropriate
   - Professional contribution role
   - Priority
   - Estimate
   - Deadline
   - Dependencies
   - Acceptance criteria
4. Add workload views using active tasks, deadlines, estimates, logged effort, availability, and blockers.
5. Add staff availability or leave adjustments.
6. Add deliverables supporting files, links, documents, deployments, campaigns, and version history.
7. Add task/project submission for internal review.
8. Add review decisions:
   - Approved
   - Revisions required
   - Rejected/cancelled where authorized
9. Preserve reviewer, feedback, deliverables, revision number, and resubmission history.
10. Support required QA/specialist review for configured services.
11. Implement the team dashboard, assignments, workload, review queue, and review details pages.

## Required tests

- Only authorized heads can assign or reassign work.
- Members can update permitted assigned work but cannot self-approve final delivery.
- Work cannot be delivered before required reviews pass.
- Revision requests return work to the correct state.
- Multiple contributors retain distinct contribution records.
- File access respects internal/client visibility and organization boundaries.
- Workload calculations use real records rather than mocked values.

## Exit criteria

- [ ] Accepted requests become deliverable projects/jobs
- [ ] Team heads can assign based on workload and discipline
- [ ] Contributors can complete and submit work
- [ ] Team heads can approve or request revisions
- [ ] Review and deliverable history is auditable
- [ ] Standard verification passes

---

# Phase 4 — Secure client tracking, communication, and acceptance

## Goal

Give requesters a safe, account-free way to follow and respond to their work.

## Tasks

1. Complete the capability-link design in `19-Link-Based-Client-Tracking.md`.
2. Generate high-entropy, unique, revocable tracking tokens.
3. Ensure tokens are never placed in logs, analytics payloads, or searchable pages.
4. Implement a strict client-safe response projection.
5. Show:
   - Request code and title
   - Simplified status
   - Public timeline
   - Approved public messages
   - Delivered client-visible files/links
6. Support requester comments and staff replies with explicit internal/client-visible controls.
7. Notify the appropriate staff when a requester comments.
8. Notify the requester when:
   - Clarification is requested
   - Status changes materially
   - A client-visible reply is posted
   - Work is delivered
9. Add delivery acceptance and change-request actions.
10. Close the project only after the approved acceptance rule is satisfied.
11. Add rate limiting and abuse controls to public mutations.

## Required tests

- Invalid/revoked tokens reveal nothing.
- Internal notes, audit records, budgets, and private files never appear publicly.
- Tracking pages are `noindex`.
- Public comments are rate-limited and validated.
- Client acceptance closes only the intended project.
- Change requests return work to the correct team/revision state.
- Email links point to the correct application URL and token.

## Exit criteria

- [ ] Submission produces a working tracking link
- [ ] Client-safe tracking and conversation work end to end
- [ ] Internal information cannot leak through the tracking API
- [ ] Delivery acceptance/change request works
- [ ] Notification emails are verified in staging
- [ ] Standard verification and tracking E2E tests pass

---

# Phase 5 — Contribution-based weekly and monthly reporting

## Goal

Generate credible reports that document organization outcomes, team delivery, and individual effort.

## Tasks

1. Define report periods, timezone, cutoff rules, and finalization behavior.
2. Capture structured contributions from:
   - Task assignments and completions
   - Deliverables created or reviewed
   - Effort/time records
   - Collaboration/support contributions
   - Review and revision activity
   - Blockers and resolutions
3. Do not equate hours with performance. Present effort alongside outcomes, timeliness, quality, and collaboration.
4. Generate:
   - Agency reports
   - Team reports
   - Individual reports
   - Organization service reports
5. Include the metrics and narrative sections defined in `PRODUCT-RECOMMENDATIONS.md`.
6. Allow authorized leaders to review narrative sections before finalization.
7. Make finalized reports immutable or preserve a complete amendment history.
8. Add PDF export; add spreadsheet export only if stakeholders require it.
9. Schedule weekly and monthly generation in the worker.
10. Implement the report-centre pages from `APPLICATION-PAGE-MAP.md`.

## Required tests

- Report periods use `Africa/Lagos` consistently.
- Contributions from multiple people are all represented.
- One task cannot be double-counted after reassignment.
- Organization reports contain no other organization's records.
- Team reports contain only the correct team's work.
- Finalized reports cannot be silently altered.
- Empty periods and partially completed work render correctly.
- Worker jobs are idempotent and do not create duplicate reports.

## Exit criteria

- [ ] Weekly and monthly reports generate from real records
- [ ] Agency, team, individual, and organization views agree
- [ ] Team heads can review and finalize their reports
- [ ] Individual contributions are traceable to underlying work
- [ ] Scheduled generation is verified in staging
- [ ] Standard verification passes

---

# Phase 6 — Information architecture and scope cleanup

## Goal

Align the application UI with the approved page map and keep secondary modules from distracting core users.

## Tasks

1. Compare every implemented route with `APPLICATION-PAGE-MAP.md`.
2. Complete all Core pages required by the current role workflows.
3. Consolidate duplicate pages rather than adding parallel versions.
4. Implement role-aware navigation for:
   - Team member
   - Team head
   - Agency executive/admin
   - Finance/admin where applicable
5. Hide optional commercial and platform modules from roles that do not use them.
6. Preserve invoices, receipts, payments, integrations, CMS, sponsorships, and scorecards, but label and position them according to their approved priority.
7. Remove obsolete workspace terminology and requester-account UI.
8. Add empty, loading, error, permission-denied, and mobile-responsive states to Core pages.
9. Perform an accessibility audit of the core workflow.

## Required tests

- Navigation changes correctly by role.
- Unauthorized pages are blocked server-side, not merely hidden.
- Core journeys work at mobile and desktop viewports.
- Keyboard navigation and form labels meet accessibility expectations.
- Obsolete workspace routes do not remain reachable.

## Exit criteria

- [ ] Core page map is implemented
- [ ] Navigation reflects the user's actual work
- [ ] Optional modules do not dominate the interface
- [ ] No obsolete workspace/client-login surfaces remain
- [ ] Core accessibility and responsive checks pass
- [ ] Standard verification passes

---

# Phase 7 — Dependency modernization

## Goal

Move the application onto supported production dependencies without mixing upgrades with domain-model changes.

## Tasks

1. Create a dedicated upgrade branch after Phases 1–6 are green.
2. Standardize the deployment runtime on an approved Node.js LTS release.
3. Upgrade one dependency family at a time:
   - Prisma 5 to Prisma 6 first
   - Auth.js/NextAuth beta to a supported stable release
   - Next.js and React to compatible supported releases
   - Associated ESLint, TypeScript, and type packages
4. Do not jump directly to Prisma 7 unless its ESM, generated-client, datasource, and migration changes are separately planned and approved.
5. Run official codemods where available, then review every change.
6. Resolve deprecations rather than suppressing them.
7. Validate worker, email rendering, PDF generation, file storage, authentication, and webhooks after upgrades.
8. Update runtime and dependency documentation.

## Required tests

- Full unit, integration, E2E, typecheck, lint, and production build
- Staff authentication, magic links/OAuth, MFA, and session invalidation
- Prisma migrations and critical queries
- BullMQ worker startup and scheduled jobs
- Email and PDF generation
- Paystack webhook idempotency

## Exit criteria

- [ ] Runtime uses an approved LTS release
- [ ] No production authentication dependency remains on an unapproved beta
- [ ] Upgrades are split into reviewable commits/PRs
- [ ] No unresolved deprecation or security warnings remain
- [ ] Full verification passes

---

# Phase 8 — Staging acceptance and production relaunch

## Goal

Safely replace the unused deployment with the refocused application and prove the complete operating workflow.

## Tasks

1. Freeze schema and feature changes for the release candidate.
2. Create a fresh production backup and record the rollback point.
3. Apply migrations to a recent production database copy in staging.
4. Verify web and worker processes independently.
5. Run the full acceptance scenario:
   - Create an organization
   - Submit a request
   - Route it to the correct team head
   - Request and supply clarification
   - Accept and plan the request
   - Assign multiple contributors
   - Complete tasks and submit deliverables
   - Request one revision
   - Approve and deliver
   - Notify the requester
   - Accept the delivery
   - Generate weekly/monthly reports showing each contributor
6. Run an explicit cross-organization attack/isolation test.
7. Verify backups, monitoring, logging, email delivery, storage, queues, scheduled jobs, and webhook signatures.
8. Approve the release candidate with stakeholders from both teams.
9. Deploy during an agreed window.
10. Apply the approved production-data strategy.
11. Run post-deployment smoke tests.
12. Monitor errors, queues, emails, and database health closely after deployment.
13. Retain the previous artifact and database backup for rollback.

## Exit criteria

- [ ] Full staging acceptance scenario passes
- [ ] Product Development representative approves the workflow
- [ ] Brands & Communications representative approves the workflow
- [ ] Organization-isolation tests pass
- [ ] Production migration/reset is explicitly approved
- [ ] Production smoke tests pass
- [ ] Monitoring and rollback are ready
- [ ] Documentation matches the deployed application

---

# 9. Features not to add during this program

Do not add these unless separately approved:

- Native mobile application
- Microservice decomposition
- AI-generated performance scoring
- Payroll or HR core functionality
- Full accounting/bookkeeping
- Unrequested CRM expansion
- Multiple client portal variants
- New payment providers beyond the approved billing scope
- Advanced marketing automation unrelated to work delivery
- Gamified employee rankings

# 10. Final definition of done

The refocus is complete only when:

- Ethree10 operates as one agency with two configured teams.
- Staff position and authorization are separate.
- Organizations can submit complete requests.
- Requests reliably reach the correct team head.
- Team heads can assign work using discipline and workload information.
- Contributors can execute, document, and submit their work.
- Team heads can require revisions and approve delivery.
- Requesters can track, communicate, receive, and accept delivery securely.
- Weekly and monthly reports document agency, team, organization, and individual contributions.
- Cross-organization isolation and role permissions are tested.
- The supported stack passes all verification in staging and production.
- The deployed application and documentation describe the same operating model.

# 11. Initial instruction to the implementing AI

Use the following instruction when beginning implementation:

```text
Read AI-PHASED-REFOCUS-IMPLEMENTATION-PLAN.md and every file listed in its Required Reading section. Execute Phase 0 only. Do not implement product changes yet. Preserve all uncommitted work, inspect the deployed-but-unused environment without mutating it, verify production backups and record counts, establish a staging environment, run the baseline verification commands, and produce the required phase report. Stop and wait for approval before Phase 1.
```
