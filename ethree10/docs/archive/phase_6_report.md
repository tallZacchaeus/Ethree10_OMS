# Phase 6 Information Architecture Report

**Implemented:** 17 July 2026

## Delivered

- Replaced the legacy workspace-named client context with a single-agency staff context.
- Added server-side staff-membership enforcement at the authenticated application boundary.
- Added server-side role guards for agency, team-leadership, admin, organization, people, and position route groups.
- Rebuilt primary navigation for team members, team heads, agency leadership, and finance users. Optional commercial and platform modules are separated from daily delivery work.
- Added the missing organization directory and organization service-history view.
- Added notification centre, staff profile, individual contribution history, and position management pages.
- Added public privacy, terms, request-success, and delivery-acceptance routes.
- Added the approved agency/team/report routes as redirects to canonical shared implementations, avoiding duplicate competing pages.
- Removed obsolete workspace migration utilities and active department/workspace terminology.
- Added empty, loading, permission, mobile drawer, and `aria-current` navigation behavior across the core surfaces.

## Consolidation decisions

- `/my-work` uses the canonical task register.
- Team and agency report routes use the canonical report centre and report detail page.
- Delivery acceptance remains inside the secure tracking page; `/track/[token]/accept` redirects there.
- Routing and review-rule configuration use the service catalog, where destination team and required reviews are already maintained.
- Report generation, narrative editing, and export remain actions on the report centre/detail page.

## Access model

- Team members see personal work, requests/projects they may access, tasks, contributions, inbox, notifications, and profile.
- Team heads receive the team dashboard, intake, assignment, workload, review, member, and team-report surfaces.
- Agency leadership receives agency oversight, organizations, people, teams, reports, audit, and settings.
- Finance users receive agency read oversight, reports, and commercial records without operational mutation permissions.
- API authorization remains the final resource-level enforcement layer beneath page guards.
