# Phase 11 Health and Smoke Checks Report

**Implemented:** 18 July 2026

## Delivered

- Added `/api/health?mode=live` for dependency-free liveness.
- Added `/api/health?mode=ready` for app, database, and Redis readiness.
- Added `pnpm check:smoke` for post-deploy smoke verification.
- Wired production deploy to run `SMOKE_BASE_URL=https://oms.ethree10.com pnpm check:smoke` after readiness verification.
- Added unit coverage ensuring the health route stays dynamic and Node.js-bound.

## Verification Evidence

- `tests/unit/health-route.test.ts` covers the route runtime contract.
- Full local validation evidence is recorded in `phase_12_report.md`.

## Operational Notes

- `mode=live` is appropriate for uptime monitors.
- `mode=ready` is appropriate after deploys, restarts, or suspected dependency incidents.
