# Phase 4–5 Implementation and Verification Report

**Implemented:** 17 July 2026  
**Migration:** `20260717210000_phase4_5_tracking_reporting`  
**Reporting timezone:** `Africa/Lagos`

## Phase 4 — Secure client tracking and acceptance

- Public capability links now expire, can be revoked, and can be rotated by authorized staff.
- Public API responses are constructed from a strict allow-list: request code/title, simplified status, public timeline, client-visible messages, target date, and client-visible deliverables only.
- Requester identity, email, phone, brief, budget, audits, internal notes, private files, and internal project records are excluded.
- Public mutation limits use SHA-256-derived keys with database-backed atomic counters shared across web instances. Raw capability tokens are not used as rate-limit keys or logged.
- Staff retain an explicit internal/client-visible reply control. Public replies and material stage changes use the existing email notification path.
- Delivery now updates both Project and Request state and emails the tracking link.
- Client acceptance is the only public workflow that closes a delivered project. Change requests increment the client and task revisions, reopen the affected delivered tasks, and notify the team.
- Staff can rotate or revoke a tracking link from request details. Rotating invalidates the previous link and emails the replacement when consent permits.

## Phase 5 — Contribution reporting

- Weekly periods run Monday–Sunday and monthly periods use calendar months, both as Africa/Lagos instants persisted in UTC.
- Reports are generated at agency, team, member, and client-organization levels.
- Metrics come from real requests, projects, tasks, active task contributors, deliverable versions, time logs, reviews, revision decisions, comments, and blocker states.
- Task outcomes are counted once per task while each qualifying contributor receives a distinct traceable contribution record. Reassignment attribution uses the assignment interval at completion time.
- Effort hours are presented beside outcomes, timeliness, quality/revisions, and collaboration; they are never converted into a performance score.
- Draft narrative sections can be reviewed by authorized agency admins or the relevant team head.
- Finalized reports are not regenerated or silently edited. Amendments preserve previous and new metrics/narrative with actor, reason, timestamp, and version.
- PDF export is authenticated and uses the same report visibility rules as the report centre.
- BullMQ schedules completed weekly reports at Monday 00:15 and completed monthly reports on day one at 00:30, both in `Africa/Lagos`. The manual cron endpoint requires `CRON_SECRET`.

## Verification evidence

| Gate | Result |
|---|---|
| Prisma schema validation | Passed |
| Migration rehearsal on local PostgreSQL | Passed |
| TypeScript | Passed |
| ESLint | Passed, no warnings |
| Unit tests | Passed, 47/47 |
| Integration tests | Passed, 29/29 |
| Phase 4–5 integration tests | Passed, 5/5 |
| Playwright E2E | Passed, 23/23 |

The integration coverage verifies the public field allow-list, private deliverable exclusion, revoked-token behavior, change-request revision reopening, acceptance isolation, organization report isolation, multi-contributor attribution, idempotent generation, and finalized-report immutability.

## Deployment requirements

1. Back up production and apply the forward-only migration.
2. Set a long random `CRON_SECRET` and confirm Redis is reachable from the worker process.
3. Verify the application base URL and Resend credentials, then exercise received/status/reply/delivery emails in staging. The local suite intentionally received a Resend 401 from the placeholder API key, so real email delivery is the remaining staging-only gate.
4. Start the worker separately and confirm both repeatable jobs are registered with the Africa/Lagos timezone.
5. Run the complete tracking acceptance and report-finalization journey against staging data.
