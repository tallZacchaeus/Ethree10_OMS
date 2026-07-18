# Data Governance and Audit Retention

This document defines the current operational policy for audit records in Ethree10 OMS.

## Active audit logs

- Active audit logs remain queryable in the app for the most recent 24 months by default.
- Audit logs are agency-global operational records, not client-facing project records.
- Active logs should be used for security review, role-change review, request lifecycle review, and incident triage.

## Archived audit logs

- Logs older than the configured retention window should be moved from `AuditLog` to `ArchivedAuditLog`.
- Archived logs preserve actor, action, entity type, entity id, original creation time, and before/after change payloads.
- Archived logs are retained for compliance and historical investigation, but they are not part of the normal in-app audit list.

## Running retention

Use a dry run first:

```bash
pnpm audit:archive
```

Archive and delete one batch of stale active logs:

```bash
pnpm audit:archive -- --execute
```

Optional controls:

```bash
pnpm audit:archive -- --days=730 --batch-size=500 --execute
```

The CLI defaults to:

- `--days=730`
- `--batch-size=500`
- dry-run mode unless `--execute` is provided

## Operational rule

Run the dry run before executing archival. If the stale count is unexpectedly high, pause and inspect recent migrations/imports before running with `--execute`.
