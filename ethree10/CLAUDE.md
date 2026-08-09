# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (Next.js + BullMQ workers run concurrently)
pnpm dev

# Next.js only (no worker)
pnpm dev:next

# Type checking, linting, building
pnpm typecheck
pnpm lint
pnpm build

# Unit tests (Vitest, node environment)
pnpm test
pnpm test:watch

# Run a single unit test file
pnpm test -- tests/unit/authorization.test.ts

# E2E tests (Playwright, Chromium only)
pnpm test:e2e

# Database
pnpm db:deploy       # PRODUCTION: apply pending migrations (prisma migrate deploy)
pnpm db:migrate      # dev: create + apply a migration from schema changes
pnpm db:push         # local prototyping ONLY — never against a shared or production DB
pnpm db:seed         # seed demo data
pnpm db:generate     # regenerate Prisma client after schema changes
pnpm db:studio       # open Prisma Studio UI
```

### Schema changes

The migration history was baselined on 2026-08-09 (`20260809000000_baseline`)
after a long period of `db push` development left it unusable. From here:

- **Never run `db push` against a shared or production database.** It is for local
  prototyping only, and `--force-reset` destroys data.
- Change `schema.prisma`, then `pnpm db:migrate` to generate a migration.
- Deploys run `pnpm db:deploy` (`prisma migrate deploy`), which applies pending
  migrations and never resets.
- `prisma/migrations/migration_lock.toml` must stay committed; without it Prisma
  cannot read the folder as a history.

Env validation runs on every server boot. Copy `.env.example` to `.env.local` and fill in all required keys before running anything. Set `SKIP_ENV_VALIDATION=true` to bypass (CI only).

Docker Compose provides local Postgres + Redis:

```bash
docker compose up -d
```

## Architecture

### Route groups

The app uses three Next.js route groups in `app/`:

- `(marketing)/` — public marketing site (home, services, about, contact, public request form, public invoice viewer). Uses `ClientMarketingNav`.
- `(auth)/` — login and magic-link-sent pages. No sidebar.
- `(app)/` — the authenticated OMS application. Staff only. All pages here require session; the layout enforces auth and MFA.

### Organisation model

Ethree10 is **one agency**. There is no workspace/tenant abstraction — it was removed. The hierarchy is:

```
Agency → Branch (2) → Department (many) → People
```

Business terms map onto the schema as follows, and this mapping is the contract:

| Business term | Prisma model | Lead |
|---|---|---|
| **Branch** — Digital Media, Tech & Product | `Team` | `Team.leadId` (`branch_head`) |
| **Department** — Engineering, Design & Brand, … | `SubUnit` | `SubUnit.leadId` (`department_lead`) |
| **Client organisation** | `Organization` | — |

The models keep their old names for now; the UI and roles use Branch/Department. Renaming the models is an outstanding mechanical change.

### Data access

Staff queries are **agency-global** — there is no `scopedDb`, no `workspaceId`, and no `x-workspace-id` header. Use the `db` singleton from `server/db/client.ts`. Where a role should only see part of the agency, scope explicitly (see `visibleTeamIds` in `server/trpc/routers/requests.ts`, which limits non-agency-wide roles to their own branches).

Client data is grouped by `organizationId`. Clients have no accounts at all.

### tRPC

- Server entry: `app/api/trpc/[trpc]/route.ts`
- Context: `server/trpc/context.ts` — resolves session, userId, and an `authorize(action)` helper.
- Procedures: `server/trpc/procedures.ts` exports `publicProcedure`, `protectedProcedure`, and `superAdminProcedure`.
- All routers are wired in `server/trpc/routers/_app.ts`.
- Client usage: `lib/trpc/client.ts` (React Query hooks), `lib/trpc/server.ts` (server-component caller).

### Auth

Auth.js v5 with a custom adapter (`server/auth/config.ts`). The adapter maps operations onto the `User` + `OAuthAccount` models instead of the standard Auth.js table names. Providers: Resend magic-link, Google OAuth, and a dev-only `Credentials` provider that auto-creates/logs in any email without sending mail.

Sessions use JWT strategy. The JWT callback copies `user.id` into `token.userId`; the session callback copies it to `session.user.id`. MFA is enforced at the `(app)` layout level using a `mfa-verified` cookie.

### RBAC

Permissions are a union type `Action` in `server/auth/permissions.ts`. The `ROLE_PERMISSIONS` map declares which actions each `Role` may perform. `requireAgencyAction(userId, action)` in `server/services/agency.ts` resolves the user's memberships and throws `TRPCError(FORBIDDEN)` if no role grants the action.

Named role groups live in `server/auth/role-groups.ts` (`AGENCY_WIDE_ROLES`, `DELIVERY_LEAD_ROLES`, `FINANCE_ROLES`, …) plus helpers like `hasAgencyWideScope()`. **Use these rather than inlining role arrays** — copy-pasted arrays are how the previous model drifted apart.

The seven roles:

| Role | Purpose |
|---|---|
| `super_admin` | Technical platform owner. Escape hatch, not operational. |
| `chief_executive` | Overall head. Agency-wide read, comments, and the **only** role that can approve a budget. No delivery writes. |
| `agency_admin` | Runs operations and configuration. **No** budget approval or payments. |
| `finance_manager` | Invoices, confirms payments, issues receipts, pays expenses. **Cannot** approve budgets. |
| `branch_head` | Heads a branch (`Team`) and its departments. Full delivery authority within it. |
| `department_lead` | Leads a department (`SubUnit`). Assigns and reviews that department's work. |
| `team_member` | Delivers assigned work. |

### Money governance — read before touching invoices, receipts or budgets

All of it lives in `server/services/budget.ts`. Two rules:

1. **Approval gate.** No invoice may be sent and no expense paid until the Chief Executive has approved the project's budget. Call `BudgetService.assertApproved(projectId)` before any money action.
2. **Separation of duties.** The budget approver may never confirm the resulting payment; a requester may never pay their own expense. `assertSeparationOfDuties()` also blocks one user holding both `chief_executive` and `finance_manager`.

Receipts are only ever created by `confirmInvoicePayment`. Do not call `ReceiptService.issueForInvoice` directly from a router — that is exactly the bypass that existed before.

Verify with `pnpm tsx scripts/verify-governance.ts` (24 assertions against a live DB).

See `../GOVERNANCE-AND-JOURNEYS.md` for the full model and per-role journeys.

### Background workers

`workers/index.ts` runs three BullMQ workers (notifications, reports, integrations) as a separate process alongside Next.js. The weekly report job is scheduled with a cron pattern (`0 18 * * 6`, Saturday 18:00 Africa/Lagos). In production, run the worker as a separate process with `pnpm worker`.

### Integrations

Integration secrets are AES-256-GCM encrypted at rest via `INTEGRATION_SECRET_KEY`. The integration layer lives in `server/integrations/`:
- `core/` — registry, service base, crypto, type definitions
- `plane/` — outbound task create/update + inbound webhook handler
- `trello/` — Trello adapter

Webhooks for Plane, Stripe, and Paystack are at `app/api/webhooks/`.

### PDF generation

Reports and proposals are rendered to PDF using `@react-pdf/renderer`. Server-side PDF route handlers live under `app/api/reports/`. The React component for report layout is in `server/reports/pdf.tsx` and `components/reports/report-pdf.tsx`.

### Notifications

`server/services/notification.ts` persists in-app notifications and optionally queues email jobs. Email templates use `@react-email/components` and are sent via Resend (`server/notifications/email/`). WhatsApp delivery uses Twilio (`server/notifications/twilio.ts`).

### Testing

- Unit tests: `tests/unit/` — Vitest, node environment, `@` alias resolved to project root. Currently covers authorization logic and env validation.
- E2E tests: `tests/e2e/` — Playwright, Chromium. Configured to spin up `pnpm dev:next` automatically unless `CI=true`. Base URL defaults to `http://localhost:3000` or `PLAYWRIGHT_BASE_URL`.
- Integration tests: `tests/integration/` — Vitest, separate from unit tests (not included in default `pnpm test` run).

### Key conventions

- All server-only code lives under `server/`. Never import from `server/` in client components.
- Components follow shadcn/ui patterns; base primitives are in `components/ui/`, extended variants in `components/ui-ext/`.
- i18n scaffolding is in `lib/i18n.ts` with a `useTranslation` hook at `lib/hooks/use-translation.ts`.
- The `@` path alias resolves to the project root (configured in both `tsconfig.json` and `vitest.config.ts`).
- Prisma schema changes always require `pnpm db:generate` before TypeScript will compile.
