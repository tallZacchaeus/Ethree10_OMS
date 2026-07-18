# Release Management

This app is already deployed, so releases should be treated as production changes even before broad user onboarding.

## Release sequence

1. Merge only after CI passes typecheck, lint, unit tests, build, and readiness checks.
2. Confirm the deploy workflow runs `/srv/ethree10/deploy.sh`.
3. Confirm post-deploy gates pass:
   - `pnpm check:readiness:db`
   - `SMOKE_BASE_URL=https://oms.ethree10.com pnpm check:smoke`
   - `SECURITY_HEADERS_BASE_URL=https://oms.ethree10.com pnpm check:security-headers`
   - `pnpm check:backups`
4. Review `/api/health?mode=ready`.
5. Confirm `supervisorctl status` shows both web and worker processes running.

## Pre-release checklist

- Migration impact is understood.
- A recent database backup exists.
- A recent MinIO backup exists.
- The rollback commit SHA is known.
- User-facing workflow impact is documented.
- Payment, request intake, tracking links, reports, and worker queues have a smoke path.

## Rollback rule

Rollback application code first. Restore the database only when there is verified data corruption or an explicitly approved recovery action.

## Change notes

Each phase report should state:

- What changed.
- Which files/scripts were introduced.
- Which verification gates passed.
- Known limitations or deferred risks.
