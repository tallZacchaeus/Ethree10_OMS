# Pilot Acceptance Plan

Phase 18 defines the minimum acceptance path before inviting real external users.

## Pilot users

Use a small internal pilot first:

- 1 agency admin
- 1 Product Development team head
- 1 Brands & Communications team head
- 2 team members across both teams
- 1 requester/client representative

## Acceptance paths

Each pilot should validate the path relevant to their role.

### Request intake

- Submit a public request with organization details.
- Include expected outcome, deliverables, acceptance criteria, urgency, and supporting links.
- Confirm the request is visible to the agency team.

### Team assignment

- Agency admin or team head routes the request to the correct team.
- Team head assigns work to the appropriate personnel.
- Team member sees assigned work in their working view.

### Delivery and review

- Team member marks work ready for review.
- Team head reviews the work.
- Team head marks the job done only after vetting.

### Client tracking

- Client/requester opens the secure tracking link.
- Client sees safe public progress, deliverables, invoices/receipts where applicable, and acceptance controls.
- Client accepts the completed delivery or requests changes.

### Reporting

- Generate or inspect weekly report coverage.
- Confirm team output is visible.
- Confirm individual effort attribution is visible.

## Exit criteria

Pilot is accepted only when:

- Request intake works without staff help.
- Assignment and review match the agency operating model.
- Client tracking link works without creating a client account.
- Weekly report includes organization, team, and individual effort context.
- No high-priority operational issue remains open.

## Command

```bash
pnpm check:pilot-readiness
```
