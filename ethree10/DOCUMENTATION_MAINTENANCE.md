# Documentation Maintenance Policy

This file exists to make documentation updates mandatory whenever the Ethree10 OMS application changes.

Rule:

A code change is not complete until the affected documentation has been updated in the same change.

## Non-negotiable requirement

If you change any of the following, you must update the related documentation before the work is considered done:

- routes or pages
- API handlers or tRPC procedures
- Prisma schema or business entities
- roles, permissions, or approval flows
- environment variables
- integrations or webhook behavior
- background jobs or cron logic
- deployment steps or infrastructure
- test commands, CI behavior, or build requirements
- navigation, major UI flows, or user-facing terminology

## Minimum documentation review for every change

For every feature, bug fix, refactor, or deployment change, review these files:

1. `README.md`
2. `docs/deployment.md` if runtime, infrastructure, env, storage, queues, domains, or deployment flow changed
3. Parent specification docs in `../` if the product contract changed materially
4. `.env.example` if the env contract changed
5. Test or operational docs if commands or expected behavior changed

## Update matrix

Use this quick map to decide what to edit.

### If you change product behavior
Update:

- `README.md`
- Any relevant parent product/spec doc in `../`

Examples:

- new module added
- route removed or renamed
- request/project/task workflow changed
- invoice/proposal/report behavior changed

### If you change the data model
Update:

- `README.md` data model summary if the change is notable
- parent schema docs in `../05-Data-Model-and-Schema.md` when needed
- any setup/seed notes affected by the change

Examples:

- new Prisma model
- renamed enum values
- changed relationships or required fields

### If you change auth, roles, or permissions
Update:

- `README.md`
- `../03-User-Roles-and-Permissions.md` when the product contract changed

Examples:

- new role
- new permission action
- MFA flow changes
- workspace access changes

### If you change environment variables or integrations
Update:

- `README.md`
- `.env.example`
- `docs/deployment.md`
- any integration-specific notes

Examples:

- storage provider change
- webhook secret change
- Resend/Twilio/Stripe/Paystack config changes
- new required `NEXT_PUBLIC_*` variable

### If you change deployment or runtime operations
Update:

- `docs/deployment.md`
- `README.md`
- workflow docs/comments if relevant

Examples:

- CI/CD change
- process manager change
- port/domain/path changes
- backup, logging, queue, or worker changes

### If you change tests or developer workflow
Update:

- `README.md`
- any docs mentioning commands or quality gates

Examples:

- new test suite
- renamed scripts
- new required local service
- changed build prerequisites

## Definition of done

Before you mark work complete, confirm all of these:

- [ ] Code change is implemented
- [ ] Affected docs were reviewed
- [ ] Affected docs were updated in the same change
- [ ] `README.md` still matches the live codebase
- [ ] `.env.example` matches `lib/env.ts` if env validation changed
- [ ] `docs/deployment.md` matches the actual deployment process if runtime behavior changed
- [ ] New warnings, blockers, or known limitations are documented if not fixed

## Documentation quality standard

Documentation updates must be:

- truthful to the current codebase
- specific, not marketing fluff
- updated in the same commit/PR/change as the code
- clear enough for a new developer to use without guessing

## Fast checklist for contributors and agents

Before finishing any task in this repo, ask:

1. Did I change how the app works?
2. Did I change what is required to run/build/deploy it?
3. Did I change anything a future developer would need to know?

If the answer to any of those is yes, update the docs now.
