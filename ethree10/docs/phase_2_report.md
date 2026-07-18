# Phase 2: Service Catalog, Intake, and Routing

**Completed:** 17 July 2026

## Delivered

- Configurable `Service` catalog with owning team, required brief fields, expected deliverables, default urgency/SLA, and specialist-review requirements.
- Seeded services for Product Development and Brands & Communications plus an agency-level cross-team fallback.
- Public `/services` catalog and complete `/request` brief covering organization, contact, problem, outcome, deliverables, acceptance criteria, urgency, deadline, budget, supporting links, and email consent.
- Complete internal `/requests/new` form with organization and service selection.
- Automatic routing to the service's team; services without an owner go to agency-admin intake.
- `/team/intake` and `/settings/services` staff pages.
- Team-head and agency-admin clarification, acceptance, rejection, and re-routing controls.
- Full stage/decision timeline and client email notifications when consent was provided.
- Public tracking projection suppresses internal routing notes and internal comments.
- Safe organization deduplication requires both normalized organization name and matching requester email domain; same-name organizations on unrelated domains remain separate.
- Globally unique request sequence generation fixed.

## Security and tests

Integration coverage now verifies:

- Cross-team project reads and mutations are rejected.
- A service routes to its configured team.
- A fallback service remains unrouted for agency-admin intake.
- Required brief fields are enforced server-side.
- A team head cannot accept another team's request.
- Organization deduplication does not merge unrelated email domains.
- Invoice receipt issuance remains idempotent.

## Verification

| Command | Result |
|---|---|
| `pnpm db:generate` | Passed |
| `pnpm typecheck` | Passed, exit 0 |
| `pnpm lint` | Passed, exit 0 |
| `pnpm test` | Passed, 43/43 |
| `pnpm test:integration` | Passed, 21/21 |
| `pnpm build` | Passed, exit 0; 42 pages generated |
| `PLAYWRIGHT_BASE_URL=http://localhost:3002 pnpm exec playwright test tests/e2e/request-form.spec.ts tests/e2e/marketing-lead.spec.ts --workers=1` | Passed, 7/7 against the production build and migrated Docker database |
| `pnpm exec prisma migrate deploy` | Passed on the local rehearsal database |
| `pnpm db:seed` | Passed; canonical teams, positions, and services created |

## Deployment notes

No production deployment or production database mutation was performed. Apply migrations first in staging, validate request submission, email, storage, and workers, then schedule production with a verified backup and rollback window.

## Known limitations

- Supporting files are represented by existing attachment infrastructure, but the refreshed request forms currently collect supporting links rather than direct uploads.
- Live email delivery was not verified with production credentials.
- The Phase 2 public journey passes browser E2E. The older full E2E collection still contains historical authentication, `/departments`, and billing expectations and is not represented as green.

## Recommendation

Proceed to Phase 3 only after staging acceptance of the Phase 1/2 migration and the public request-to-team-intake journey.
