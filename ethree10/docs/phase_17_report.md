# Phase 17 Report: Monitoring Readiness

## Scope

Phase 17 defines the observability and alerting contract needed before real user onboarding.

## Implemented

- Added `pnpm check:monitoring`.
- Added `docs/monitoring.md`.
- Added `.env.example` entries for:
  - `MONITORING_ALERT_EMAIL`
  - `UPTIME_MONITOR_URL`
- Added unit coverage for monitoring readiness.

## Policy

Monitoring is documented and testable, but not yet wired as a deploy blocker. Promote it into `.github/workflows/deploy.yml` after production Sentry, PostHog, and uptime monitor accounts are confirmed.
