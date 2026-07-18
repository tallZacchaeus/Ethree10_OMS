# Production Deployment Inventory

**Date:** 16 July 2026
**Environment:** Live Production (Unused)

## Deployment Architecture
- **Hosting Platform:** Hostinger VPS (not Vercel)
- **VPS IP:** `85.209.95.137`
- **Domain:** `https://oms.ethree10.com`
- **Application Path:** `/srv/ethree10/ethree10/`
- **Process Manager:** Supervisor (`ethree10-web`, `ethree10-worker`)
- **Web Server/Proxy:** Nginx
- **SSL:** Let's Encrypt (Certbot)
- **Deployment Script:** `/srv/ethree10/deploy.sh` (Triggered via GitHub Actions)

## Infrastructure Components
- **App Server:** Next.js 14 (Node.js LTS) on port 3001
- **Background Worker:** BullMQ running via `tsx`
- **Database:** PostgreSQL 15 (Docker: `ethree10-postgres-1`)
- **Cache & Queue:** Redis 7 (Docker: `ethree10-redis-1`)
- **Object Storage:** MinIO (Docker: `ethree10-minio-1`), publicly served at `https://oms.ethree10.com/files/`

## Third-Party Services & Webhooks
- **Email Provider:** Resend
- **Transactional Comms:** Twilio WhatsApp (Optional fallback)
- **Payments:** Paystack (v1.0 active), Stripe (Disabled for v1.0)
- **Integrations:** Plane (per-workspace, encrypted secrets at rest)
- **Analytics:** PostHog (No-op if key missing)

## Backups & Scheduled Jobs
- **Database Backup:** Daily at 02:00 UTC, stored at `/srv/ethree10/backups/db/` (14 days retention)
- **MinIO Backup:** Weekly Sunday at 03:00 UTC, stored at `/srv/ethree10/backups/minio/` (7 days retention)
- **Scheduled Workers:** Report generation cron job running every Saturday at 18:00 (Africa/Lagos)

## Limitations & Pending Items
- Access to the VPS requires `VPS_SSH_KEY` from GitHub Secrets, meaning local validation of production database record counts cannot be performed without explicit remote execution or human intervention.
- The `AUTH_GOOGLE_ID` and `SENTRY_DSN` configs are pending real values.
