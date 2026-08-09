# Phase 9 Release Automation Report

**Implemented:** 18 July 2026

## Delivered

- Added `NEXTAUTH_URL` to CI build and E2E environments so NextAuth.js v4 is configured explicitly.
- Added a dedicated **Launch Readiness** CI job that runs `pnpm check:readiness` against a production-shaped environment.
- Added a post-deploy VPS readiness verification step that runs `pnpm check:readiness:db` after `/srv/ethree10/deploy.sh`.
- Kept the readiness gate separate from normal local test envs so local HTTP URLs remain valid for Playwright while production promotion still checks HTTPS/public-origin requirements.

## Why this phase matters

Phase 8 created the readiness checker. Phase 9 wires it into release automation so missing production secrets, wrong public URLs, wrong Node runtime, or missing seed data can block promotion instead of being discovered after users arrive.

## Verification Evidence

- Workflow changes are static YAML updates.
- The Phase 8 readiness evaluator is already covered by unit tests.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed, 53/53 unit tests.
- `pnpm build`: passed.

## Operational Notes

- The deploy job now fails if the VPS cannot pass `pnpm check:readiness:db`.
- This means production env values and seed state must be fixed before deployment is treated as successful.
- Docker-backed integration tests were not rerun in this phase because Docker is not running locally.
