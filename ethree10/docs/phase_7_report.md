# Phase 7 Runtime Modernization Report

**Implemented:** 18 July 2026

## Delivered

- Upgraded the app framework from Next.js 14 to Next.js 16.2.10.
- Upgraded the React runtime from React 18 to React 19.2.7.
- Upgraded ESLint from v8 to v9.39.3 and replaced `next lint` with the supported `eslint .` command.
- Upgraded peer-sensitive runtime packages for the new framework baseline: Sentry, Resend, React Email, and Nodemailer.
- Kept Prisma pinned on 6.19.3 as the stable ORM baseline for this phase.
- Kept authentication on stable `next-auth` 4.24.14 and added the explicit `nodemailer` runtime dependency required by its email provider module.
- Migrated the legacy `.eslintrc.json` config to `eslint.config.mjs`.
- Replaced `middleware.ts` with the Next 16 `proxy.ts` entrypoint while preserving the root login/dashboard redirect behavior.
- Migrated dynamic App Router params and search params to the async Next 16 contract.
- Migrated `cookies()` usage to the async request API.
- Replaced the deprecated `experimental.serverComponentsExternalPackages` setting with `serverExternalPackages`.
- Accepted Next 16's required TypeScript config changes: `jsx: react-jsx`, `target: ES2017`, and `.next/dev/types/**/*.ts` in `include`.
- Recorded pnpm build-script approvals for Prisma, esbuild, and sharp so installs complete cleanly under pnpm 11.

## Version Baseline

- Node engine: `>=24 <25`
- pnpm: `11.4.0`
- Next.js: `16.2.10`
- React: `19.2.7`
- React DOM: `19.2.7`
- next-auth: `4.24.14`
- @sentry/nextjs: `10.66.0`
- @react-email/components: `1.0.12`
- resend: `6.17.2`
- nodemailer: `7.0.7`
- Prisma CLI/client: `6.19.3`
- ESLint: `9.39.3`
- eslint-config-next: `16.2.10`

## Compatibility Notes

- Local validation was executed through Node 22.17.1 because the machine's local Node 24 binary is currently broken by a missing native `simdjson` dylib. The project manifest and CI still enforce Node 24.
- `next-auth` v4's email provider imports `nodemailer` even when a custom Resend sender is configured, so `nodemailer` is now a direct dependency pinned to the v7 peer range.
- Next 16 production build uses Turbopack by default. The sandbox blocked Turbopack's helper process from binding a local port during CSS processing; the same build passed when run with the necessary local process permission.
- React compiler lint rules surfaced existing form/local-state synchronization patterns. The flat ESLint config keeps those exceptions narrow and file-specific instead of disabling the rules globally.
- Production build and E2E logs still warn that `NEXT_PUBLIC_POSTHOG_KEY` and `NEXTAUTH_URL` are missing in the local environment. These are environment configuration items, not code failures.
- Integration/E2E logs still show Resend 401 messages where tests exercise notification paths with placeholder local credentials. The affected tests pass because email delivery is non-authoritative for those workflows.

## Verification Evidence

- `pnpm install --store-dir "$HOME/Library/pnpm/store/v11"`: passed after recording `sharp` build approval.
- `pnpm prisma validate`: passed.
- `pnpm prisma generate`: passed.
- `pnpm peers check`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed, 49/49 unit tests.
- `pnpm test:integration`: passed, 29/29 integration tests.
- `pnpm build`: passed, 80 dynamic app routes plus Proxy.
- `pnpm test:e2e`: passed, 23/23 Playwright tests.

## Remaining Operational Work

- Install or repair a working local Node 24 runtime before using the app without the Node 22 workaround.
- Set production/staging `NEXTAUTH_URL`, `NEXT_PUBLIC_POSTHOG_KEY`, and valid email credentials before real launch traffic.
- Run the deployment platform build after these commits land, because production infrastructure should be the final authority for Node 24 and Turbopack behavior.
