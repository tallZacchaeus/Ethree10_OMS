# Remediation plan

Phased fix for the 41 gaps in the combined audit (2026-08-20). Each phase is a
shippable unit with its own PR or small set of PRs, ordered so that earlier
phases make later ones safe rather than merely earlier.

**The ordering principle:** restore service, then close what an attacker could
use today, then rebuild the safety net, and only then touch anything structural.
Refactoring `scopedDb` or the RBAC model before the RBAC tests can run is doing
surgery with the lights off.

Phases 0–2 are sequential and should not overlap. From Phase 3 onward, phases
can run in parallel if more than one person is working.

---

## Phase 0 — Restore service · **blocking everything**

Production is unreachable and both backups are dead. Nothing else in this plan
matters until this is closed, and no code change should be deployed until there
is a backup to roll back to.

| # | Task | Finding |
|---|---|---|
| 0.1 | Get the VPS responding — provider console, check power and out-of-band console for disk/boot errors | F-02 |
| 0.2 | **Take a database backup by hand the moment SSH works**, before any other action | F-02 |
| 0.3 | Verify that dump restores into a scratch database and contains real row counts | F-02 |
| 0.4 | Re-run the backup diagnostics workflow; fix scheduling from what it shows | F-02 |
| 0.5 | Raise `BACKUP_DB_MIN_SIZE_BYTES` from 1024 to something near a real dump | F-02 |

**Exit criteria:** `pnpm check:backups` prints `OK` for both targets, and a
restore has been performed at least once end to end.

> **0.3 is the one people skip.** A backup that has never been restored is a
> hypothesis. The 10,950-byte dumps may be perfectly good — a small dataset
> compresses hard — but nobody has confirmed it, and the size floor is low
> enough that a truncated dump would pass.

### Decision needed

The VPS is a single point of failure with no staging environment. Options:
managed Postgres with automated PITR; a second VPS; or accept the risk with
off-site backup copies. **Recommendation:** at minimum, ship backups off the
box — a backup on the machine that dies is not a backup.

---

## Phase 1 — Close the open doors · **~1 day, tiny diffs**

Small, independently shippable, disproportionate risk reduction. Do these
before anything structural.

| # | Task | Finding |
|---|---|---|
| 1.1 | Guard the credentials provider with `NODE_ENV !== "production"` **in addition to** the `E2E_TEST_AUTH` check | F-01 |
| 1.2 | Add a readiness check that **fails** production when `E2E_TEST_AUTH` is set | F-01 |
| 1.3 | Unit-test that the provider list excludes credentials when `NODE_ENV=production`, regardless of `E2E_TEST_AUTH` | F-01 |
| 1.4 | Rate-limit `invoices.getByCode` and `receipts.getByCode` using the existing `enforcePublicRateLimit` | F-17 |
| 1.5 | Audit-log failed lookups so enumeration is visible | F-17 |

**Exit criteria:** a production build with `E2E_TEST_AUTH=true` refuses to boot,
and brute-forcing invoice codes is throttled and leaves a trail.

**Why first:** 1.1 is roughly a five-line change that closes a complete
authentication bypass. There is no argument for sequencing it behind anything.

---

## Phase 2 — Rebuild the safety net · **~3 days**

Everything after this is a change to security-critical code. The tests that
should catch a mistake in that code currently run nowhere.

| # | Task | Finding |
|---|---|---|
| 2.1 | Fix `tests/integration/setup.ts`: drop the hardcoded username, default to the compose port `5433` | F-36 |
| 2.2 | Add `pnpm verify` — start compose, wait for health, migrate the test DB, create buckets, run unit + docs + integration | F-36, F-04 |
| 2.3 | Add an `integration` job to CI (Postgres + Redis services already exist in the e2e job) | F-04 |
| 2.4 | Add a `docs` job to CI | F-04 |
| 2.5 | Add `pnpm audit --audit-level high` as a CI job (non-blocking first, blocking once the backlog clears) | F-05 |
| 2.6 | Add `.github/dependabot.yml` — weekly, grouped minor/patch | F-05 |
| 2.7 | Wire `verify-governance.ts` into a package script so the 24 governance assertions are runnable | F-22 |

**Exit criteria:** `pnpm verify` passes from a clean checkout on a machine that
has never run this project, and CI runs all four suites.

**Why before Phase 3+:** Phases 3–5 change payment code, permission code, and
delete a database wrapper. `tests/integration/rbac.test.ts` and
`governance.test.ts` are exactly the tests that catch mistakes there.

---

## Phase 3 — Billing security · **~4 days**

The `/api/files` route documents in a comment that billing PDFs are protected
only by the document code, and that codes "must stay random and unguessable."
`Math.random()` does not provide that. This phase makes the comment true.

| # | Task | Finding |
|---|---|---|
| 3.1 | Replace `Math.random()` code generation in `invoices.ts` and `receipt.ts` with `randomBytes` | F-03 |
| 3.2 | Replace `Math.random()` in the WhatsApp verification code with `randomInt` | F-18 |
| 3.3 | Add a collision retry (catch `P2002`, regenerate, bounded attempts) | F-03 |
| 3.4 | Decide and implement the position on **existing** codes — see below | F-03 |
| 3.5 | Unit-test that generated codes are CSPRNG-derived and of stable length | F-03 |

### Decision needed — existing invoice codes

New codes being secure does nothing for codes already sent to clients. Three
options:

1. **Rotate and resend.** Regenerate every unpaid invoice's code, email fresh
   links. Safest; breaks links already in client inboxes.
2. **Add a second factor to the PDF route.** Keep codes as identifiers, require
   a signed token for the document. Doesn't break the human-readable code.
3. **Accept for historical invoices, secure new ones.** Cheapest. Leaves paid
   invoices — which carry client names, amounts and project detail — reachable
   by anyone who predicts a code.

**Recommendation: 2.** Codes stop being secrets and become identifiers, which
is what they read like anyway. `generatePublicToken()` already exists and does
exactly this job for request tracking.

---

## Phase 4 — Correctness bugs · **~3 days**

Real defects with user-visible symptoms, independent of each other.

| # | Task | Finding |
|---|---|---|
| 4.1 | Fix template task codes — use the same year-scoped sequence as `nextTaskSeq()`, not a project-scoped count | F-06 |
| 4.2 | Make payment confirmation atomic: `where: { id, paymentConfirmedAt: null }` so a concurrent second confirm updates zero rows | F-08 |
| 4.3 | Replace count-based sequences with a Postgres sequence, or add bounded `P2002` retry | F-07 |
| 4.4 | Add a reconciliation check for paid invoices with no receipt; surface on the readiness or admin screen | F-09 |
| 4.5 | Regression tests for each of the above | — |

**Note on 4.1:** applying a template to any project after the first one in a
calendar year currently throws a unique-constraint error. This is likely
reproducible on demand and worth confirming with a test before the fix.

---

## Phase 5 — Remove the landmines · **~2 days**

Code and docs that are wrong in ways that will mislead the next person —
including a future AI agent reading the repo.

| # | Task | Finding |
|---|---|---|
| 5.1 | Delete `scopedDb` and remove it from the tRPC context; update the three integration tests | F-35 |
| 5.2 | Collapse the super-admin dual model — either give the enum role real permissions or drop the enum member | F-37 |
| 5.3 | Remove `mfaEnabled` / `mfaSecret` / `mfaRecoveryCodes` and the stub router methods, or reinstate MFA | F-11 |
| 5.4 | Fix `CLAUDE.md`: the MFA claim, the `scopedDb` claim, the stale testing section, the Stripe and Trello references | F-22 |

**5.1 requires Phase 2.** Deleting a database wrapper touched by three RBAC
tests is only safe once those tests run.

### Decision needed — MFA

Reinstating MFA is a Phase 7-sized piece of work; the schema fields are already
there. Removing the fields is an hour. **The question is whether a system
holding client financial records should have a second factor at all** — with 25
staff and magic-link plus Google sign-in as the only routes today. My view: for
`finance_manager`, `chief_executive` and `super_admin`, yes.

---

## Phase 6 — Dependencies and platform hygiene · **~3 days**

| # | Task | Finding |
|---|---|---|
| 6.1 | Upgrade Next.js past the middleware-bypass and SSRF advisories — you use Turbopack, which one advisory names directly | F-05 |
| 6.2 | Upgrade `next-auth`, `sharp`, `postcss`, `nodemailer`; clear the 3 critical advisories | F-05 |
| 6.3 | Set `SENTRY_DSN` in production — `instrumentation.ts` is wired and inert without it | F-12 |
| 6.4 | Add `app/global-error.tsx` and route-level `error.tsx` | F-14 |
| 6.5 | Add `loading.tsx` to the slowest route segments | F-15 |

**6.1 is the one to schedule carefully.** A Next.js major upgrade on a project
with no staging environment and a single production box needs Phase 0's
restore-tested backup in place first.

---

## Phase 7 — Least privilege and capability URLs · **~4 days**

| # | Task | Finding |
|---|---|---|
| 7.1 | Narrow `finance_manager` reads — justify each of the 15 or drop it | F-39 |
| 7.2 | Scope attachment access to the parent's branch, matching `visibleTeamIds` in the requests router | F-10 |
| 7.3 | Shorten public token lifetime from 365 days; add a resend flow first so clients aren't stranded | F-38 |
| 7.4 | Log token use; make `publicTokenRevokedAt` reachable from the UI | F-38 |
| 7.5 | Verify uploaded file content against the declared MIME type rather than trusting the client | F-16 |

**7.3 ordering matters:** ship the resend flow, then shorten the lifetime. The
reverse breaks live client links.

---

## Phase 8 — Say only what is true · **~2 days**

| # | Task | Finding |
|---|---|---|
| 8.1 | Make the analytics page read its own config instead of asserting PostHog is active | F-40 |
| 8.2 | Rename the integrations surface to reflect one adapter; remove or mark the "Coming Soon" tiles honestly | F-40 |
| 8.3 | Replace the README score table with the current state | F-40 |
| 8.4 | Assign branch heads — `0/2` today, and the assignment approval flow routes to them | F-13 |

**8.4 is a five-minute change with real consequence:** auto-assignment
proposals currently have nobody to approve them.

---

## Phase 9 — Records to decisions · **separate track, ongoing**

Not remediation. This is the product roadmap, and the README already names it
as the platform's biggest weakness. It should not block or be blocked by
Phases 0–8.

Starting points, cheapest first: show the branch name in the requests table
instead of "Assigned"/"Unassigned"; add age and next action; give the workload
screen a rebalancing action rather than only a reading; extend analytics beyond
completed-tasks-per-month to payment latency and SLA breach rate.

---

## Sequencing summary

```
Phase 0  ████ blocking — service down, no backups
Phase 1  ██ auth bypass, rate limiting        ← do not defer behind anything
Phase 2  ███ make tests runnable + CI          ← gate for 3,4,5
Phase 3  ████ billing security          ┐
Phase 4  ███ correctness bugs           │ parallelisable
Phase 5  ██ landmines + docs            ┘ (5 needs 2)
Phase 6  ███ dependencies, platform
Phase 7  ████ least privilege, tokens
Phase 8  ██ honesty pass
Phase 9  ──── product track, continuous
```

Roughly four weeks of focused work for one person through Phase 8, excluding
Phase 0, which is measured in hours and blocks the rest.

## Decisions needed before starting

1. **Backup and DR posture** (Phase 0) — off-site copies at minimum; managed
   Postgres worth pricing.
2. **Existing invoice codes** (Phase 3.4) — recommendation: signed token on the
   PDF route, keep codes as identifiers.
3. **MFA** (Phase 5.3) — reinstate for finance and executive roles, or remove
   the schema residue and accept single-factor.
