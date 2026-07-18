# Ethree10 OMS Operations Runbook

Use this runbook after launch for incidents, backup checks, restores, and release verification.

## Normal deploy verification

```bash
cd /srv/ethree10/ethree10
pnpm check:readiness:db
SMOKE_BASE_URL=https://oms.ethree10.com pnpm check:smoke
SECURITY_HEADERS_BASE_URL=https://oms.ethree10.com pnpm check:security-headers
pnpm check:backups
curl -fsS "https://oms.ethree10.com/api/health?mode=ready"
supervisorctl status
```

Deployment is not complete until the readiness gate, smoke check, security header check, backup freshness check, health endpoint, and Supervisor status are clean.

## Health triage

| Symptom | First checks | Likely owner |
|---|---|---|
| `/api/health?mode=live` fails | `supervisorctl status`, web logs, Nginx status | App/server |
| `/api/health?mode=ready` fails on database | Postgres container, `DATABASE_URL`, disk usage | Database |
| `/api/health?mode=ready` fails on Redis | Redis container, `REDIS_URL`, worker logs | Queue/worker |
| Public pages work but jobs stall | `supervisorctl status ethree10-worker`, Redis, worker logs | Worker |
| Invoice payment does not update | Paystack webhook logs, `PAYSTACK_SECRET_KEY`, receipt logs | Payments |

## Monitoring readiness

Run before inviting real pilot users:

```bash
pnpm check:monitoring
```

Minimum acceptance:

- Server and browser Sentry DSNs are configured.
- PostHog project key and host are configured.
- `UPTIME_MONITOR_URL` targets `/api/health?mode=ready`.
- Alerts route to `MONITORING_ALERT_EMAIL`.

## Pilot readiness

Run before the first internal pilot:

```bash
pnpm check:pilot-readiness
```

Use `docs/pilot-acceptance.md` as the pilot script. Do not onboard external organizations until request intake, team assignment, review, tracking, and weekly reporting have been accepted by the internal pilot users.

## Logs

```bash
tail -f /var/log/ethree10/web.log
tail -f /var/log/ethree10/worker.log
tail -f /var/log/ethree10/backup-db.log
tail -f /var/log/ethree10/backup-minio.log
```

## Backup verification

Run weekly until the first month of production usage is stable, then monthly.

```bash
ls -lh /srv/ethree10/backups/db/
ls -lh /srv/ethree10/backups/minio/
bash /srv/ethree10/backup-db.sh
bash /srv/ethree10/backup-minio.sh
cd /srv/ethree10/ethree10
pnpm check:backups
```

Minimum acceptance:

- Latest database dump exists and is less than 24 hours old after the daily backup window.
- Latest MinIO backup exists and is less than 7 days old.
- Backup logs do not show failed commands.
- Backup directories have enough disk space for the retention window.
- `pnpm check:backups` passes against the VPS backup directories.

## Restore rehearsal

Do this on a separate staging machine or isolated database. Never restore over production without explicit approval.

1. Copy the latest database dump from `/srv/ethree10/backups/db/`.
2. Create a temporary Postgres database.
3. Restore the dump into the temporary database.
4. Point a staging `.env` at the restored database.
5. Run:

```bash
pnpm db:generate
pnpm prisma migrate deploy
pnpm check:readiness:db
SMOKE_BASE_URL=<staging-url> pnpm check:smoke
```

## Incident response

1. Confirm scope: login, public request, tracking links, invoices, worker jobs, or all traffic.
2. Check `/api/health?mode=live` and `/api/health?mode=ready`.
3. Check Nginx, Supervisor, Postgres, Redis, and MinIO status.
4. If a recent deploy caused the incident, roll back the app commit first.
5. If data corruption is suspected, stop writes before attempting repair.
6. Record timeline, affected workflows, mitigation, and follow-up actions.

## Rollback

```bash
cd /srv/ethree10
git checkout <known-good-sha>
cd ethree10
pnpm install --frozen-lockfile
pnpm db:generate
pnpm build
supervisorctl restart ethree10-web ethree10-worker
pnpm check:readiness:db
SMOKE_BASE_URL=https://oms.ethree10.com pnpm check:smoke
```

Database rollback is restore-from-backup only. Do not run destructive database commands without a verified backup and explicit approval.
