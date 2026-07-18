# Agency admin guide

You configure the agency operating model and keep the system ready for real client work.

## First setup

1. Run `pnpm check:readiness:db` in the deployed environment.
2. Confirm both canonical teams exist:
   - Product Development
   - Brands & Communications
3. Assign a team head to each team.
4. Add staff members and assign their role, team, position, and skills.
5. Review the service catalog and map every service to the correct team or to agency-level routing.
6. Confirm `NEXTAUTH_URL`, Paystack, email, storage, and observability settings before launch.

## People and teams

- Use **Members** to invite and manage staff.
- Use **Teams** to assign team heads and maintain delivery ownership.
- Use **Positions** to keep professional titles clean for reports.
- Do not create client users for tracking; client visibility is link-based.

## Services and routing

- Use **Settings -> Services** to define request types, required brief fields, default SLA, destination team, and specialist reviews.
- Keep one fallback service for cross-team or unclear solution requests.
- Route requests by service first, then by team capacity and expertise.

## Organizations

- Use **Organizations** to keep every requester/client, request, project, invoice, receipt, and report tied to the correct external organization.
- Confirm organization records are clean before weekly or monthly reporting, because organization context is the anchor for documentation and client-facing history.

## Governance

- Use **Audit** for accountability.
- Use **Reports** for weekly and monthly delivery reviews.
- Use **Settings -> Security** for MFA and security controls.
- Run `pnpm check:readiness` before deployment and `pnpm check:readiness:db` after deployment.

## Launch checklist

- Real production secrets are set.
- Node 24 is active.
- Database migrations have run.
- Seed data has created canonical teams, services, and the first super admin.
- Public request, tracking, invoice, receipt, and login flows have been smoke tested.
- Team heads know how to triage, assign, review, and close work.
