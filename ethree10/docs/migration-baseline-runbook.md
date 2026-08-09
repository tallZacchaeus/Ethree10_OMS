# Migration baseline — what changed and what to run

**Date:** 2026-08-09

## What was wrong

`prisma/migrations/00000000000000_baseline/migration.sql` was **two lines of
comment and created nothing**:

```sql
-- Baseline for the production database schema that existed before Prisma
-- migration history was introduced on this VPS.
```

The very next migration then ran:

```sql
ALTER TABLE "Department" RENAME TO "Team";
```

…against a table nothing had created. That is fine on the VPS, whose tables
already existed from earlier `db push` runs — the empty baseline was an accurate
description *of that one database*. It is fatal anywhere else:

```
Error: P3018
ERROR: relation "Department" does not exist
```

**Consequences:** CI failed on every run (E2E never reached a single test), and
no new environment — staging, a fresh laptop, a rebuild after failure — could be
created at all.

## What changed

All ten migration folders were replaced with a single squashed baseline,
`0_init`, generated from the current schema: **1,373 lines, 48 tables**. The old
folders are recorded below for reference.

Verified two ways before shipping:

| Scenario | Result |
|---|---|
| `migrate deploy` onto an empty database | applies cleanly, **zero drift** vs `schema.prisma` |
| Existing database + old history, after `migrate resolve` | "No pending migrations", **zero drift**, no data touched |

---

## What to run on the VPS — before redeploying

Your database already has the schema. It must be told the new baseline is
*already applied*, or Prisma will try to create tables that exist.

```bash
cd /path/to/ethree10
git pull
pnpm install
pnpm exec prisma migrate resolve --applied 0_init
pnpm exec prisma migrate deploy
pnpm exec prisma migrate status   # expect: "Database schema is up to date!"
```

`migrate resolve` only inserts a row into `_prisma_migrations`. It runs no SQL
against your tables and **cannot touch your data**. `migrate deploy` then finds
nothing pending.

Take a database backup first anyway. It costs a minute.

### If you deploy without the resolve step

You will get this, and it is recoverable:

```
Error: P3018
ERROR: type "Role" already exists
```

The failed attempt leaves a **failed migration row that blocks every later
deploy**. Recover with:

```bash
pnpm exec prisma migrate resolve --rolled-back 0_init
pnpm exec prisma migrate resolve --applied 0_init
pnpm exec prisma migrate deploy
```

No data is lost in this path — the migration aborts on the first statement,
before altering anything.

---

## From here

- Change `schema.prisma`, then `pnpm db:migrate` to generate a migration.
- Deploy with `pnpm db:deploy` (`prisma migrate deploy`).
- **Never run `db push` against a shared or production database.** It is for
  local prototyping, and `--force-reset` destroys data.
- **`migration_lock.toml` must stay committed.** Without it Prisma cannot read
  the folder as a history at all — it was missing before this change.

A test in `tests/docs/phase6-ia.test.ts` asserts the baseline exists *and*
actually creates the `Team` table, so an empty baseline cannot silently return.

## Migrations replaced by `0_init`

Their SQL is preserved in git history at commit `ff06ef7`:

```
00000000000000_baseline                      (empty — the bug)
20260716000000_phase1_refocus
20260717000000_phase2_service_catalog
20260717150000_phase3_execution
20260717210000_phase4_5_tracking_reporting
20260717213000_public_rate_limit
20260720000000_relax_legacy_workspace_columns
20260720010000_activate_pending_staff_invites
20260720030000_remove_mfa_state
20260809120000_governance_uploads_reporting
```
