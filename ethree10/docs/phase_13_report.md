# Phase 13 Report: Security Headers and Header Verification

## Scope

Phase 13 adds baseline browser security protections and a deploy-time verification command.

## Implemented

- Added global Next.js response headers:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` disabling camera, microphone, geolocation, USB, and Bluetooth by default
  - `Content-Security-Policy-Report-Only` with Paystack, PostHog, Supabase image, and Google profile image allowances
- Added `pnpm check:security-headers` to validate production header presence through the live health endpoint.
- Added a deployment workflow step that runs the security header check against `https://oms.ethree10.com`.
- Added unit coverage for the global header rule.

## Notes

The CSP is report-only in this phase to avoid breaking deployed auth, analytics, payment, or client-side runtime scripts without production violation data. It can be moved to enforcing mode after observing production traffic.
