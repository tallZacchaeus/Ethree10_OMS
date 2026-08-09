# Agency Admin — user guide

You configure the agency operating model and keep the system ready for real
client work. You run operations; you do not run the money.

## What you do here

- Invite staff and set their role, branch, department, position and skills.
- Maintain the two branches and the departments inside them.
- Own the service catalogue: routing, required brief fields, SLA, reviews.
- Manage client organisations, integrations and the marketing site content.
- Full delivery authority — route, assign, review, close.

## What you deliberately cannot do

You cannot approve budgets (Chief Executive) and you cannot confirm payments or
pay expenses (Finance Manager). Operational power is kept separate from money
power on purpose: an admin who can both restructure the agency and move its funds
is a single point of failure.

You *can* submit a budget for approval and request spend against an approved one.

## First setup

1. Confirm both branches exist:
   - **Tech & Product**
   - **Digital Media**
2. Assign a **branch head** to each.
3. Create the departments inside each branch and assign a **department lead** to
   each.
4. Add staff and assign role, branch, department, position and skills.
5. Review the service catalogue and map every service to the correct branch, or
   to agency-level review for anything cross-branch.
6. Confirm `NEXTAUTH_URL`, database, Paystack, email, storage and observability
   settings before launch.

## People, branches and departments

- **People** — invite and manage staff, and change roles.
- **Branches** — the two arms of the agency, their departments, and their leads.
- **Positions** — professional titles, kept separate from authorisation roles.
- Do **not** create accounts for clients. Client visibility is link-based: they
  submit from the public site and get a private tracking link.

### A role assignment the system will refuse

You cannot give one person both **Chief Executive** and **Finance Manager**. The
invite and the role change will both fail with an explanation. This is separation
of duties and it is deliberate — do not work around it with a shared account.

## Services and routing

Requests now arrive **unclassified** — the public form no longer asks the client
to pick a service or set urgency. A human classifies at triage. That makes the
service catalogue and the Intake Queue more important, not less:

- Use **Service Catalog** to define each service's destination branch, required
  brief fields, default SLA and specialist reviews.
- Keep one fallback service for cross-branch or unclear requests.
- Make sure branch heads know the Intake Queue is a daily step.

## Governance

- **Audit** — the append-only record of every state change.
- **Reports** — weekly and monthly delivery reviews.
- **Settings → Security** — MFA. It is enforced for the Chief Executive, Agency
  Admin, Finance Manager and Branch Heads.
- Run `pnpm check:readiness` before deployment and `pnpm check:readiness:db`
  after.

## Launch checklist

- Real production secrets are set, including `NEXTAUTH_URL`.
- Node 24 is active.
- Database schema is applied and seeded.
- Both branches, their departments, and the service catalogue exist.
- The Chief Executive and Finance Manager are two different people.
- Public request, tracking link, invoice, receipt and login flows smoke tested.
- Branch heads know how to triage, classify, assign, review and close work.
