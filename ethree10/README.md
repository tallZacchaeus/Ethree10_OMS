# Ethree10 OMS

Ethree10 OMS is the operating system for Ethree10's single agency: organizations submit solution requests, services route them to Product Development or Brands & Communications, staff deliver the work, and clients track progress through secure links.

This repository is split into two layers:

- Parent folder (`Ethree10_OMS/`): product/specification documents, build plans, and AI-agent prompts.
- Application folder (`Ethree10_OMS/ethree10/`): the actual runnable Next.js application.

Documentation maintenance rule: see `DOCUMENTATION_MAINTENANCE.md`.

## What the application does

From the current codebase, the application provides:

1. Public marketing surface
   - Home, About, Services, Contact
   - Public request submission form
   - Public invoice viewer by code

2. Authentication
   - NextAuth.js v4
   - Resend magic-link login
   - Google OAuth
   - Dev-only credentials flow
   - MFA enforcement inside the authenticated app

3. Internal agency operations
   - Staff, team, position, and organization management
   - Configurable service catalog, complete request briefs, team routing, and fallback intake
   - Role-based access control
   - Request intake, triage, routing, approval, and stage tracking
   - Project and task execution
   - Department and sub-unit management
   - Member directory
   - Leads management
   - Reports, analytics, scorecards, and KPI snapshots
   - Proposal, invoice, sponsorship, and template flows
   - Integrations management
   - Notifications, audit log, and settings
   - CMS/admin surfaces for some content and analytics functions

## Product surface found in the code

Authenticated route groups under `app/(app)` include:

- `/dashboard`
- `/agency/dashboard`
- `/agency/skills`
- `/inbox`
- `/requests`, `/requests/new`, `/requests/[id]`
- `/projects`, `/projects/[id]`
- `/tasks`, `/tasks/[id]`
- `/members`
- `/teams`
- `/team/intake`
- `/settings/services`
- `/leads`
- `/integrations`
- `/reports`, `/reports/[id]`
- `/audit`
- `/settings`
- `/settings/notifications`
- `/settings/security`
- `/settings/scorecards`
- `/settings/templates`
- `/invoices`, `/invoices/new`
- `/sponsorships`
- `/knowledge`
- `/admin/analytics`
- `/admin/cms`

Public/auth route groups under `app/` include:

- `(marketing)`: `/`, `/about`, `/services`, `/contact`, `/request`, `/track/[token]`, `/invoice/[code]`, `/receipt/[code]`
- `(auth)`: `/login`, `/magic-link-sent`

Server/API endpoints found in the app include:

- `app/api/trpc/[trpc]/route.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/webhooks/paystack/route.ts`
- `app/api/webhooks/plane/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/cron/reports/route.ts`
- PDF/report routes under `app/api/reports/**`

## Architecture summary

Stack confirmed from the runnable app:

- Next.js 16 App Router
- TypeScript
- tRPC for internal API surface
- Prisma + PostgreSQL
- BullMQ + Redis for background jobs
- NextAuth.js v4 for authentication
- Tailwind CSS + Radix UI + shadcn-style components
- S3-compatible object storage via AWS SDK (configured for MinIO path-style access)
- Resend for email
- Twilio support for WhatsApp delivery
- PostHog client/server packages present
- Playwright + Vitest for test coverage

Key architectural patterns:

- Route groups split the system into marketing, auth, and authenticated app surfaces.
- The agency is implicit. Staff authorization is membership/team scoped; client-owned records carry `organizationId` and public access uses unguessable tracking tokens.
- RBAC is defined centrally in `server/auth/permissions.ts`.
- tRPC routers are composed in `server/trpc/routers/_app.ts`.
- Background processing runs from `workers/index.ts` with queues for notifications, reports, and integrations.
- Weekly report generation is scheduled for Saturday 18:00 Africa/Lagos.
- File storage is implemented in `lib/storage.ts` using S3 APIs with MinIO-compatible settings.

## Main modules discovered

The tRPC app router currently wires these modules:

- auth
- organizations
- teams
- services
- subunits
- members
- requests
- projects
- tasks
- leads
- audit
- notifications
- integrations
- reports
- dashboard
- proposals
- approvalRules
- templates
- timeLogs
- scorecards
- whatsapp
- preferences
- cms
- invoices
- analytics
- sponsorships

## Data model summary

The Prisma schema currently contains:

- 34 models
- 17 enums

Core model groups:

- Identity: `User`, `OAuthAccount`, `VerificationToken`
- Organization and people: `Organization`, `Membership`, `Team`, `Position`, `SubUnit`
- Intake configuration: `Service`
- Work intake/delivery: `Lead`, `Request`, `Project`, `Task`, `TaskDependency`, `TaskComment`, `TimeLog`
- Commercial/financial: `Proposal`, `Milestone`, `Invoice`, `Sponsorship`
- Reporting/performance: `Report`, `ScorecardConfig`, `KpiSnapshot`
- Integrations/files/comms: `Integration`, `IntegrationLink`, `Attachment`, `Notification`, `NotificationPreference`
- Governance/content: `AuditLog`, `ArchivedAuditLog`, `MarketingContent`
- Skills: `Skill`, `UserSkill`

## Repository layout

Inside `ethree10/` the important directories are:

- `app/` — Next.js routes, layouts, and API handlers
- `components/` — UI and feature components
- `lib/` — env, storage, hooks, helpers, tRPC client/server helpers
- `server/` — auth, DB access, services, reports, integrations, tRPC routers
- `prisma/` — schema and seed logic
- `workers/` — BullMQ worker process
- `tests/` — unit and Playwright E2E tests
- `docs/` — deployment runbook and app-specific docs

At the parent repository root, there is a separate specification pack:

- `00-README.md` through `18-Glossary-and-Conventions.md`
- `17-AI-Agent-Prompts/`

Those parent documents explain product intent and phased build planning. This `README.md` describes the runnable application as it exists in code.

## Local development

Prerequisites:

- Node.js
- pnpm
- Docker Desktop or equivalent local Docker runtime

Start local infra:

```bash
docker compose up -d
```

The local compose file starts:

- PostgreSQL 15
- Redis 7
- Maildev

Recommended app setup:

```bash
cp .env.example .env.local
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Useful commands:

```bash
pnpm dev          # Next.js + worker together
pnpm dev:next     # Next.js only
pnpm worker       # worker only
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
pnpm check:readiness       # env/runtime launch checks
pnpm check:readiness:db    # env/runtime + seeded database checks
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:seed
pnpm db:studio
```

## Environment variables

Source of truth for required env validation is `lib/env.ts`.

Required server-side variables currently enforced by code:

- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `AUTH_URL`
- `NEXTAUTH_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `REDIS_URL`
- `INTEGRATION_SECRET_KEY` (64 characters)
- `STORAGE_ENDPOINT`
- `STORAGE_ACCESS_KEY`
- `STORAGE_SECRET_KEY`
- `STORAGE_BUCKET`
- `STORAGE_PUBLIC_URL`

Required client-side variables currently enforced by code:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_STORAGE_URL`

Optional/conditional variables present in the app:

- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `NEXT_PUBLIC_SENTRY_DSN`
- Sentry-related server variables used by deployment/docs

Important notes:

- `.env.example` is aligned with the current `lib/env.ts` contract.
- Run `pnpm check:readiness` before promoting a build and `pnpm check:readiness:db` after the target database is migrated and seeded.
- For local development, ensure your real `.env.local` also carries the storage variables documented here.
- When the env contract changes, update both `lib/env.ts` and `.env.example` in the same change.

## Roles and access model

Roles defined in the Prisma schema and permission layer:

- `super_admin`
- `agency_admin`
- `agency_lead`
- `department_lead`
- `subunit_lead`
- `member`
- `project_manager`
- `requester_admin`
- `requester_member`
- `requester_observer`

Permissions are checked through `AuthorizationService` and the `Action` permission map in `server/auth/permissions.ts`.

## Integrations and external services

The repository currently contains support or stubs for:

- Plane webhook/integration flow
- Trello integration adapter
- Paystack invoice payment webhook
- Stripe webhook route
- Resend email delivery
- Twilio WhatsApp delivery
- S3-compatible storage using MinIO-style configuration

Integration secrets are encrypted at rest using `INTEGRATION_SECRET_KEY`.

## Testing and current repository health

Tests present in the repository:

- Unit tests under `tests/unit/`
- E2E tests under `tests/e2e/`

Verification performed during this pass:

- `./node_modules/.bin/vitest run` -> passed
- `./node_modules/.bin/tsc --noEmit` -> passed
- `./node_modules/.bin/next lint` -> passed with warnings
- `./node_modules/.bin/next build` -> passed

Additional regression coverage added in this pass:

- `tests/unit/env-example.test.ts` verifies `.env.example` matches the current required env contract.
- `tests/unit/cron-reports-route.test.ts` verifies the cron route stays dynamic so production builds do not execute it.

Current non-blocking warnings worth cleaning up later:

- duplicate import warnings in some files
- `qrcode` default import warnings
- `posthog` default import warning

The build previously failed because env-related docs, test fixtures, and CI placeholders had drifted from `lib/env.ts`. Those are now aligned.

## Deployment

Deployment-related assets in the repository:

- `docs/deployment.md` — detailed deployment runbook
- `.github/workflows/ci.yml` — CI pipeline for typecheck, lint, tests, e2e, build
- `.github/workflows/deploy.yml` — VPS deployment workflow
- `vercel.json` — legacy/alternative platform config still present in the repo

The deployment runbook in `docs/deployment.md` documents a Hostinger VPS-based production setup using:

- Next.js app server
- BullMQ worker
- PostgreSQL
- Redis
- MinIO
- Nginx
- Supervisor

If deployment architecture changes, update `docs/deployment.md`, relevant workflow files, and this README together.

## Documentation sources in the parent folder

If you need the original product/spec context, read these from the parent repository root:

- `00-README.md`
- `01-Vision-and-Context.md`
- `02-Product-Requirements-Document.md`
- `03-User-Roles-and-Permissions.md`
- `04-User-Stories-and-Flows.md`
- `05-Data-Model-and-Schema.md`
- `06-System-Architecture.md`
- `07-Tech-Stack-and-Conventions.md`
- `08-API-and-Endpoints.md`
- `09-Integration-Layer-Spec.md`
- `10-UI-UX-Design-Brief.md`
- `11-Reporting-and-KPI-Spec.md`
- `12-Notifications-Spec.md`
- `13-Security-and-Compliance.md`
- `14-Testing-Strategy.md`
- `15-Deployment-and-DevOps.md`
- `16-Phased-Build-Plan.md`
- `18-Glossary-and-Conventions.md`

## Documentation maintenance

Before merging or shipping any change to this application, review `DOCUMENTATION_MAINTENANCE.md` and update impacted docs in the same change.
