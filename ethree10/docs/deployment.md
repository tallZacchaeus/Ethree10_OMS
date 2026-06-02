# Ethree10 OMS — Production Deployment

> **This app is deployed on a Hostinger VPS, not Vercel.**
> The original Vercel/cloud instructions are preserved below for reference.

---

## Live environment

| Item | Value |
|---|---|
| Domain | https://oms.ethree10.com |
| VPS IP | 85.209.95.137 |
| Repo path | `/srv/ethree10/` |
| App path | `/srv/ethree10/ethree10/` |
| Deploy script | `/srv/ethree10/deploy.sh` |
| Public storage URL | `https://oms.ethree10.com/files/{key}` |

---

## Stack

| Component | Technology | Location |
|---|---|---|
| App server | Next.js 14 on port 3001 | Supervisor: `ethree10-web` |
| Background worker | BullMQ (tsx) | Supervisor: `ethree10-worker` |
| Database | PostgreSQL 15 | Docker: `ethree10-postgres-1` |
| Cache / queue | Redis 7 | Docker: `ethree10-redis-1` |
| File storage | MinIO | Docker: `ethree10-minio-1` |
| Reverse proxy | Nginx | `/etc/nginx/sites-available/ethree10-oms` |
| SSL | Let's Encrypt (auto-renews every 12h) | Certbot |
| Process manager | Supervisor | `/etc/supervisor/conf.d/ethree10.conf` |

---

## Auto-deploy (CI/CD)

Push to `main` triggers:
1. **CI** (`.github/workflows/ci.yml`) — typecheck, lint, unit tests, build
2. **Deploy** (`.github/workflows/deploy.yml`) — SSHes into VPS, runs `/srv/ethree10/deploy.sh`

If deploy fails, an email is sent to `softdevs@theincubatorhub.org`.

GitHub Actions secrets required:
| Secret | Purpose |
|---|---|
| `VPS_HOST` | `85.209.95.137` |
| `VPS_SSH_KEY` | ED25519 private key for root SSH access |
| `RESEND_API_KEY` | Resend key for failure notification emails |

---

## Common commands

### Logs
```bash
tail -f /var/log/ethree10/web.log            # Next.js app
tail -f /var/log/ethree10/worker.log         # BullMQ worker
tail -f /var/log/ethree10/backup-db.log      # DB backup runs
tail -f /var/log/ethree10/backup-minio.log   # MinIO backup runs
```

### Restart
```bash
supervisorctl restart ethree10-web               # app only
supervisorctl restart ethree10-worker            # worker only
supervisorctl restart ethree10-web ethree10-worker  # both
supervisorctl status                             # check all
```

### Redeploy manually
```bash
bash /srv/ethree10/deploy.sh
```

### Rollback to a previous commit
```bash
cd /srv/ethree10
git checkout <sha>     # e.g. git checkout abc1234
cd ethree10
pnpm run build
fuser -k 3001/tcp 2>/dev/null; sleep 2
supervisorctl restart ethree10-web ethree10-worker
```

---

## Environment variables

File: `/srv/ethree10/ethree10/.env`

- **Server-only vars** (no `NEXT_PUBLIC_` prefix): `supervisorctl restart ethree10-web` — no rebuild needed.
- **Client vars** (`NEXT_PUBLIC_*`): require `pnpm run build` then restart.

| Variable | Status |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | ✅ Configured (local Postgres) |
| `AUTH_SECRET` / `AUTH_URL` | ✅ Configured |
| `RESEND_API_KEY` / `EMAIL_FROM` | ✅ Configured |
| `REDIS_URL` | ✅ Configured (local Redis) |
| `INTEGRATION_SECRET_KEY` | ✅ Configured |
| `STORAGE_*` / `NEXT_PUBLIC_STORAGE_URL` | ✅ Configured (local MinIO) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | ⏳ Add when Google OAuth is ready |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | ⏳ Add when Sentry is ready |

---

## File storage (MinIO)

MinIO runs internally at `http://127.0.0.1:9000`. Files are served publicly via Nginx at `https://oms.ethree10.com/files/`.

**Use in server code:**
```ts
import { uploadFile, deleteFile, publicUrl, presignedUrl } from "@/lib/storage";

// Upload a file, returns its public URL
const url = await uploadFile("avatars/user-123.png", buffer, "image/png");

// Get public URL for an existing file
const src = publicUrl("avatars/user-123.png");
// → https://oms.ethree10.com/files/avatars/user-123.png

// Generate a short-lived presigned URL (for private files)
const link = await presignedUrl("reports/q1.pdf", 3600);
```

**Access MinIO console (admin UI)** via SSH tunnel on your local machine:
```bash
ssh -L 9001:127.0.0.1:9001 root@85.209.95.137
# Then open http://localhost:9001
```

---

## Backups

| Backup | Schedule | Location | Retention |
|---|---|---|---|
| PostgreSQL dump | Daily 02:00 UTC | `/srv/ethree10/backups/db/` | 14 days |
| MinIO files | Weekly Sunday 03:00 UTC | `/srv/ethree10/backups/minio/` | 7 days |

Run manually:
```bash
bash /srv/ethree10/backup-db.sh
bash /srv/ethree10/backup-minio.sh
```

---

## Docker services

```bash
docker ps                                                        # view all containers
cd /srv/ethree10 && docker compose -f docker-compose.prod.yml restart  # restart all
docker logs ethree10-minio-1 --tail 50 -f                       # MinIO logs
docker logs ethree10-postgres-1 --tail 50 -f                    # Postgres logs
```

---

## Nginx

Config: `/etc/nginx/sites-available/ethree10-oms`

```bash
nginx -t               # test config before applying
systemctl reload nginx # apply without downtime
```

SSL check: `certbot certificates`

---

---

## Original cloud deployment guide (Vercel / reference)

> The following is the original developer guide for Vercel-based deployment.
> It is kept for reference only — the live app runs on the VPS above.

### Prerequisites

| Service | Purpose | Free tier? |
|---------|---------|-----------|
| Vercel | Next.js hosting | ✅ Hobby |
| Neon / Supabase | Postgres (with connection pooling) | ✅ Both |
| Upstash Redis | BullMQ broker | ✅ Up to 10k req/day |
| Resend | Transactional email | ✅ 100 emails/day |
| Google Cloud Console | OAuth 2.0 credentials | ✅ |
| Railway / Render | BullMQ worker process | ✅ Starter |
