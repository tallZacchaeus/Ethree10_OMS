# Monitoring and Alerting

Phase 17 defines the minimum monitoring contract before real user onboarding.

## Required signals

- Uptime monitor: `https://oms.ethree10.com/api/health?mode=ready`
- Server exceptions: Sentry server DSN
- Browser exceptions: Sentry public DSN
- Product analytics: PostHog project key and host
- Alert destination: `MONITORING_ALERT_EMAIL`

## Local check

```bash
pnpm check:monitoring
```

The check expects:

- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `MONITORING_ALERT_EMAIL`
- `UPTIME_MONITOR_URL`

## Alert handling

Alerts should go to the engineering mailbox first. For launch week, the person deploying should also watch:

- GitHub Actions deploy runs
- `/api/health?mode=ready`
- `/var/log/ethree10/web.log`
- `/var/log/ethree10/worker.log`

## Current policy

Monitoring is a launch-readiness gate, not an automatic deploy blocker yet. Once the production Sentry/PostHog/uptime accounts are confirmed, `pnpm check:monitoring` can be promoted into the deploy workflow.
