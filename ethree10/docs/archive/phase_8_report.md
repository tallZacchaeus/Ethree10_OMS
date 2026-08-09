# Phase 8 Launch Readiness Report

**Implemented:** 18 July 2026

## Delivered

- Added a launch-readiness evaluator in `lib/readiness.ts`.
- Added `scripts/check-readiness.ts` for command-line go-live checks.
- Added package scripts:
  - `pnpm check:readiness`
  - `pnpm check:readiness:db`
- Added `NEXTAUTH_URL` to the required environment contract so stable NextAuth.js v4 stops relying on implicit URL inference.
- Updated `.env.example`, unit env mocks, README, and deployment docs for the new env contract.
- Updated stale stack references in README/deployment docs from Next.js 14/Auth.js v5 to Next.js 16/NextAuth.js v4.
- Added unit coverage for environment readiness and database readiness evaluation.

## What the readiness gate checks

- Required production env variables are present.
- Required values are not obvious placeholders.
- Public URLs are valid and HTTPS in production mode.
- `AUTH_URL`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_APP_URL` share the same origin.
- `INTEGRATION_SECRET_KEY` is a non-placeholder 64-character hex key.
- Runtime is Node 24.x.
- Paystack keys are configured before paid invoice flows go live.
- Observability keys are present or clearly warned.
- Optional database checks confirm canonical teams, team heads, active services, accepted staff, super-admin users, and organizations.

## Commands

```bash
pnpm check:readiness
pnpm check:readiness:db
```

`check:readiness` is safe to run before database access is available. `check:readiness:db` should be run after migrations and seed data have been applied to the target environment.

## Verification Evidence

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed, 52/52 unit tests.
- `pnpm build`: passed.
- Focused unit tests passed:
  - `tests/unit/readiness.test.ts`
  - `tests/unit/env.test.ts`
  - `tests/unit/env-example.test.ts`
- `pnpm check:readiness`: ran successfully and exited non-zero as expected on this local machine because the environment still has launch blockers: Node 22 runtime, non-HTTPS local URLs, placeholder secrets, missing Paystack keys, and missing observability keys.
- `pnpm test:integration`: blocked because the local Docker daemon is not running, so the test Postgres/MinIO services are unavailable.

## Remaining Operational Work

- Repair or install the local Node 24 runtime so the readiness gate passes locally without the Node 22 workaround.
- Set production `NEXTAUTH_URL`, Paystack keys, PostHog/Sentry keys, and real email credentials on the VPS.
- Run `pnpm check:readiness:db` on the VPS after the next deployment and seed/migration pass.
- Start Docker locally before rerunning integration tests.
