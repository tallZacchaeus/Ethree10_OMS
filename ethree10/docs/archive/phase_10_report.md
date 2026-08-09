# Phase 10 Operator Onboarding Report

**Implemented:** 18 July 2026

## Delivered

- Replaced stale department/sub-unit lead guides with current guides for:
  - Agency admin
  - Team head
  - Reviewer
- Updated requester guidance for the public request and secure tracking-link model.
- Updated member guidance to use **My work** and contribution-reporting language.
- Updated README roles to match the canonical Prisma role enum.
- Added a user-guide regression test to block legacy workspace/department language in the current guide pack.

## Current Guide Pack

- `docs/user-guides/agency-admin.md`
- `docs/user-guides/team-head.md`
- `docs/user-guides/member.md`
- `docs/user-guides/reviewer.md`
- `docs/user-guides/requester.md`

## Verification Evidence

- `tests/unit/user-guides.test.ts` verifies the current guide pack exists and no longer uses legacy workspace/department language.
- Focused guide/readiness tests passed, 4/4.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed, 53/53 unit tests.
- `pnpm build`: passed.
- Docker-backed integration tests were not rerun in this phase because Docker is not running locally.

## Remaining Operational Work

- Convert these guides into in-app help once the operational UI stabilizes.
- Have Ethree10 leadership review the agency-admin and team-head language before the first real onboarding session.
