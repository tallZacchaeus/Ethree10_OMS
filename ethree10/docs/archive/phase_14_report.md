# Phase 14 Report: Audit Retention Operations

## Scope

Phase 14 moves audit archival from an inline router implementation into a reusable operational service and CLI.

## Implemented

- Added `AuditRetentionService.archiveStaleLogs`.
- Kept the in-app `audit.archiveStaleLogs` mutation, but routed it through the shared service.
- Added `pnpm audit:archive` for dry-run retention checks.
- Required `--execute` before the CLI performs archival and deletion.
- Added batch-size controls to avoid unbounded archival writes.
- Added `docs/data-governance.md` with the current retention policy and operator commands.
- Added unit coverage for cutoff calculation and CLI argument behavior.

## Operational default

The default active audit retention window is 730 days. This matches the existing 24-month behavior while giving operators an explicit, testable process.
