# Phase 15 Report: Backup Verification Gate

## Scope

Phase 15 adds an automated backup freshness check for production operations.

## Implemented

- Added `pnpm check:backups`.
- The check validates the latest database and MinIO backup files.
- Defaults:
  - database backup max age: 30 hours
  - MinIO backup max age: 192 hours
  - minimum file size: 1024 bytes
- Added environment overrides for backup paths, max ages, and minimum sizes.
- Wired the deploy workflow to run the backup gate on the VPS after smoke and security checks.
- Added unit coverage for backup freshness evaluation.

## Environment overrides

- `BACKUP_DB_DIR`
- `BACKUP_DB_MAX_AGE_HOURS`
- `BACKUP_DB_MIN_SIZE_BYTES`
- `BACKUP_MINIO_DIR`
- `BACKUP_MINIO_MAX_AGE_HOURS`
- `BACKUP_MINIO_MIN_SIZE_BYTES`

## Operational note

This check validates that backups exist and are fresh. It does not prove restore correctness. Restore rehearsal remains a separate operational task.
