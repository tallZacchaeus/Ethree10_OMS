# Staging & Production Deployment

## Prerequisites

| Service | Purpose | Free tier? |
|---------|---------|-----------|
| Vercel | Next.js hosting | ✅ Hobby |
| Neon / Supabase | Postgres (with connection pooling) | ✅ Both |
| Upstash Redis | BullMQ broker | ✅ Up to 10k req/day |
| Resend | Transactional email | ✅ 100 emails/day |
| Google Cloud Console | OAuth 2.0 credentials | ✅ |
| Railway / Render | BullMQ worker process | ✅ Starter |

---

## Step 1 — Postgres (Neon recommended)

1. Create a project at https://neon.tech
2. Copy the **pooled connection string** → `DATABASE_URL`
3. Copy the **direct (non-pooled) string** → `DIRECT_URL` (used by Prisma migrations)
4. Run migrations from your local machine pointing at the staging DB:
   ```bash
   DATABASE_URL="<direct-url>" DIRECT_URL="<direct-url>" pnpm db:migrate
   DATABASE_URL="<direct-url>" DIRECT_URL="<direct-url>" pnpm db:seed
   ```

## Step 2 — Redis (Upstash)

1. Create a database at https://upstash.com
2. Copy the **Redis URL** (starts with `rediss://`) → `REDIS_URL`

## Step 3 — Email (Resend)

1. Sign up at https://resend.com and verify your sending domain (`r4c.global`)
2. Create an API key → `RESEND_API_KEY`
3. Set `EMAIL_FROM="Ethree10 <noreply@ethree10.r4c.global>"`

## Step 4 — Google OAuth

1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add authorised redirect URI: `https://<your-domain>/api/auth/callback/google`
4. Copy **Client ID** → `AUTH_GOOGLE_ID` and **Client Secret** → `AUTH_GOOGLE_SECRET`

## Step 5 — Storage (Supabase, for file uploads)

1. Create a project at https://supabase.com
2. Copy `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
3. Copy `anon public key` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Copy `service_role key` → `SUPABASE_SERVICE_ROLE_KEY`

## Step 6 — Generate secrets

```bash
# AUTH_SECRET (32-byte base64)
openssl rand -base64 32

# INTEGRATION_SECRET_KEY (32-byte hex)
openssl rand -hex 32
```

## Step 7 — Deploy to Vercel

```bash
# Install Vercel CLI if needed
npm i -g vercel

# Link and deploy
cd ethree10
vercel --prod
```

Set all environment variables in the Vercel dashboard (Project → Settings → Environment Variables), or push them with:

```bash
vercel env add DATABASE_URL production
# repeat for each variable
```

Required variables:
- `DATABASE_URL`
- `DIRECT_URL`
- `AUTH_SECRET`
- `AUTH_URL` (e.g. `https://staging.ethree10.r4c.global`)
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `REDIS_URL`
- `INTEGRATION_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`

## Step 8 — Deploy the BullMQ worker

The worker (`pnpm worker`) must run as a **separate always-on process** — Vercel serverless functions are not suitable for it.

**Option A — Railway (easiest)**

1. Create a new Railway project, connect the same repo
2. Set the start command to `pnpm worker`
3. Add all environment variables (same as above)
4. Deploy

**Option B — Render**

1. Create a new Background Worker service
2. Build command: `pnpm install && pnpm db:generate`
3. Start command: `pnpm worker`
4. Add environment variables

## Step 9 — Verify

After deployment:
1. Visit `https://<domain>/login` — confirm the login page loads
2. Request a magic link with your email — confirm you receive it
3. Log in and create a test project
4. Check the worker logs — confirm the notification job fired
5. Navigate to `/reports` and generate a weekly report — confirm the PDF downloads

## Custom domain

In Vercel dashboard → Project → Domains, add `staging.ethree10.r4c.global` and follow the DNS instructions (CNAME or A record at your registrar).
