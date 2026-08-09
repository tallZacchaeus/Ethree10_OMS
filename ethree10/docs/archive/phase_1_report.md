# Phase 1 Verification Report

**Verified:** 17 July 2026
**Production data strategy:** Strategy B (forward-only migration). No production database was changed.

## Delivered

- One implicit Ethree10 agency, two canonical `Team` records, configurable `Position` records, and staff-only `Membership` records.
- Canonical roles: `super_admin`, `agency_admin`, `team_head`, `team_member`, and `finance_admin`.
- Workspace selection and workspace headers removed from active application paths.
- Link-only external requesters; lead conversion no longer creates client users or memberships.
- Resource-scoped project, task, request, team, invoice, and receipt authorization.
- Finance pages and procedures aligned with `finance_admin`.
- Cross-team project read/mutation integration coverage.

## Migration rehearsal

The local PostgreSQL database contained the legacy schema and no Prisma migration history. A custom-format backup was created inside the local Postgres container at `/tmp/ethree10_pre_phase1.dump`. Pre-migration counts were: memberships 0, requests 0, projects 0, organizations 0.

The original Phase 1 SQL failed during rehearsal because PostgreSQL does not permit newly-added enum values to be used in the same transaction. The migration was corrected to rebuild `Role` with explicit `CASE` mappings. The corrected Phase 1 SQL then executed successfully. It was baselined with `prisma migrate resolve`, after which Phase 2 applied successfully through `prisma migrate deploy`.

Production remains untouched. Before production rollout, create and restoration-test a production backup, record real row counts, and follow the same baseline procedure if production has no `_prisma_migrations` history.

## Verification

| Command | Result |
|---|---|
| `pnpm db:generate` | Passed |
| `pnpm typecheck` | Passed, exit 0 |
| `pnpm lint` | Passed, exit 0 |
| `pnpm test` | Passed, 43/43 |
| `pnpm test:integration` | Passed as part of the expanded Phase 2 suite, 21/21 |
| `pnpm build` | Passed, exit 0; 42 pages generated |
| `pnpm exec prisma db execute --file prisma/migrations/20260716000000_phase1_refocus/migration.sql` | Passed after enum fix |
| `pnpm exec prisma migrate deploy` | Passed for the subsequent Phase 2 migration |

## Rollback

Application rollback is by reverting the release commit. Database rollback is restore-from-backup; these migrations intentionally have no destructive down migration. Production execution requires explicit approval.

## Decision

Phase 1 is complete in code and local verification. Production migration remains a separately approved deployment operation.
