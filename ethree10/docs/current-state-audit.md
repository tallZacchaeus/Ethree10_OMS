# Current State Audit & Gap Analysis

**Date:** 16 July 2026

## Overview
This audit maps the currently implemented models, routers, pages, and architecture against the requirements defined in `PRODUCT-RECOMMENDATIONS.md` and `APPLICATION-PAGE-MAP.md`.

## Data Model (Prisma Schema)
### Supported Concepts (Needs Refactoring)
- **Workspaces:** Currently uses generic workspaces. The migration to `Organization` (client orgs) and a single implicit Ethree10 Agency is partially completed in the schema (on the `feat/workspace-to-orgs` branch).
- **Staff Roles:** Exists globally but requires updates to align with the simplified model (`super_admin`, `executive`, `admin`, `department_lead`, `member`, `client`, `client_viewer`).
- **Departments:** Exists but requires rebranding or refactoring to `Teams` (Product Development and Brands & Communications).
- **Projects & Tasks:** Full structures exist with dependencies, comments, and attachments.
- **Reporting:** Structured records and snapshots exist (`Report`, `ScorecardConfig`, `KpiSnapshot`).

### Missing Concepts
- **Public Tracking Links:** `publicToken` exists in schema on the active branch, but the full link capability and email distribution requires finalization.
- **Role vs Position Separation:** Missing a standalone `Position` model distinct from access control roles.
- **Dedicated Team Triage Fields:** Missing specific `Service` routing configurations and team-level SLAs on the `Request` model.

## Page Map & Routes
### Implemented (To Be Preserved or Repositioned)
- `/dashboard` (Needs splitting into Team/Agency variants)
- `/requests`, `/requests/new`, `/requests/[id]`
- `/projects`, `/projects/[id]`
- `/tasks`, `/tasks/[id]`
- `/members`, `/departments` (Needs migrating to `/teams` and `/teams/[id]`)
- `/reports`, `/reports/[id]`
- `/audit`, `/settings/*`
- Optional modules: `/invoices`, `/sponsorships`, `/integrations`, `/admin/analytics`, `/admin/cms`, `/proposals`
- Public pages: `/`, `/about`, `/services`, `/contact`, `/request`, `/login`, `/magic-link-sent`

### Missing / Gap (Required for Core MVP)
- `/track/[token]`, `/track/[token]/accept` (Untracked work exists locally, needs completion)
- `/privacy`
- `/my-work`, `/my-contributions`
- Team-level views: `/team/dashboard`, `/team/intake`, `/team/assignments`, `/team/workload`, `/team/reviews`, `/team/reviews/[id]`, `/team/members`, `/team/reports`
- Agency-level views: `/agency/requests`, `/agency/projects`, `/agency/reports`
- Organization views: `/organizations`, `/organizations/new`, `/organizations/[id]`, `/organizations/[id]/requests`
- Staff & Role config: `/positions`
- Workflow config: `/settings/services`, `/settings/routing`, `/settings/reporting`

## API Routers (tRPC)
- **Currently wired:** 28 total routers including `auth`, `workspaces`, `departments`, `subunits`, `members`, `requests`, `projects`, `tasks`, `leads`, `audit`, `reports`, `dashboard`, `invoices`, `integrations`, etc.
- **Gap:** `trackRouter` is untracked locally and needs wiring. `workspacesRouter` must be sunset and replaced with `organizationsRouter` and agency-global procedures. `departmentsRouter` should become `teamsRouter`.

## Isolation and Security
- Currently utilizes `scopedDb(workspaceId)` which must be systematically removed and replaced with explicit `organizationId` matching for client endpoints, and agency-global fetching for staff endpoints.
- Role-Based Access Control (RBAC) in `server/auth/permissions.ts` must be refined.

## Tests
- Currently, the application has basic unit tests and a suite of Playwright E2E tests.
- **Gap:** Requires explicit cross-organization isolation tests (checking that Organization A cannot read Organization B's data).
- Requires testing that removed workspace scopes don't expose data globally without staff authorization.
