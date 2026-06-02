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
pnpm db:migrate      # run pending migrations
pnpm db:push         # push schema without migration (dev shortcut)
pnpm db:seed         # seed demo data
pnpm db:generate     # regenerate Prisma client after schema changes
pnpm db:studio       # open Prisma Studio UI
```

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
- `(app)/` — the authenticated OMS application. All pages here require session; the layout enforces auth, MFA, and workspace context.

### Data access: scoped DB

Every authenticated tRPC procedure that operates inside a workspace uses `scopedDb(workspaceId)` from `server/db/client.ts` rather than the raw `db` singleton. `scopedDb` automatically injects `{ workspaceId }` into every `findMany`, `findFirst`, and `count` call so row-level workspace isolation is enforced without per-call boilerplate. Raw `db` is only used for super-admin operations or pre-auth bootstrap.

The active workspace ID is stored in `localStorage` (`ethree10.activeWorkspaceId`) and attached to every tRPC request as the `x-workspace-id` header by the tRPC client link.

### tRPC

- Server entry: `app/api/trpc/[trpc]/route.ts`
- Context: `server/trpc/context.ts` — resolves session, userId, workspaceId, scopedDb, and an `authorize(action)` helper.
- Procedures: `server/trpc/procedures.ts` exports `publicProcedure`, `protectedProcedure`, `superAdminProcedure`, and `workspaceProcedure`. Use `workspaceProcedure` for anything that requires workspace context; it adds `ctx.scope` (a `scopedDb` instance) and validates the `x-workspace-id` header.
- All routers are wired in `server/trpc/routers/_app.ts`.
- Client usage: `lib/trpc/client.ts` (React Query hooks), `lib/trpc/server.ts` (server-component caller).

### Auth

Auth.js v5 with a custom adapter (`server/auth/config.ts`). The adapter maps operations onto the `User` + `OAuthAccount` models instead of the standard Auth.js table names. Providers: Resend magic-link, Google OAuth, and a dev-only `Credentials` provider that auto-creates/logs in any email without sending mail.

Sessions use JWT strategy. The JWT callback copies `user.id` into `token.userId`; the session callback copies it to `session.user.id`. MFA is enforced at the `(app)` layout level using a `mfa-verified` cookie.

### RBAC

Permissions are defined as a union type `Action` in `server/auth/permissions.ts`. The `ROLE_PERMISSIONS` map declares which actions each `Role` (Prisma enum) may perform. `AuthorizationService.require(userId, action, workspaceId)` in `server/services/authorization.ts` resolves the user's memberships and throws `TRPCError(FORBIDDEN)` if none of their roles grant the action.

Roles: `super_admin`, `agency_admin`, `agency_lead`, `department_lead`, `subunit_lead`, `member`, `project_manager`, `requester_admin`, `requester_member`, `requester_observer`.

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
