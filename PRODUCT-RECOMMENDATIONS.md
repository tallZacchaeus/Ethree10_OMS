# Ethree10 OMS — Product Recommendations

**Status:** Proposed product direction  
**Prepared:** 16 July 2026  
**Purpose:** Refocus the existing OMS around Ethree10's real agency operating model.

## 1. Product vision

Ethree10 OMS should be the single system through which organizations submit work to Ethree10, agency leaders route that work to the correct team, personnel execute it, team heads review it, clients receive the approved delivery, and weekly/monthly reports are generated from recorded contributions.

The product's core promise is:

> Every organizational request becomes accountable, assigned, reviewed, delivered, and reportable work.

## 2. Ethree10 operating structure

Ethree10 is one agency with two operational teams.

### Product Development Team

Typical professional positions include:

- Product Manager
- Technical Product Manager
- Product Designer
- Software Developer
- Frontend Developer
- Backend Engineer/Developer
- Software Tester/Quality Assurance Engineer

### Brands and Communications Team

Typical professional positions include:

- Social Media Manager
- Content Writer
- Graphic Designer
- Technical Content Writer
- Email Marketer
- Other communications specialists

The list of positions should be configurable. A person's professional position must not be used as their authorization role.

## 3. Recommended authorization roles

Keep system permissions small and predictable:

| Role | Scope | Principal responsibilities |
|---|---|---|
| Super Admin | Entire system | Technical administration and emergency access |
| Agency Executive/Admin | Entire agency | Oversight, configuration, reporting, and escalation |
| Team Head | Assigned team | Triage, assign, review, approve, and report on work |
| Team Member | Assigned team | Execute assigned work, collaborate, and submit for review |
| Finance/Admin | Commercial records | Manage invoices, payments, and receipts when required |

External requesters should initially use secure request-tracking links instead of application accounts. A client portal can be introduced later if organizations need a consolidated view of all their requests.

## 4. Core information model

The application should consistently use these concepts:

- **Agency:** Ethree10; one implicit agency rather than a selectable workspace.
- **Organization:** A sibling initiative or external client requesting work.
- **Team:** Product Development or Brands and Communications.
- **Position:** A person's professional discipline or job title.
- **Membership:** A staff member's relationship to a team and authorization role.
- **Service:** A type of work Ethree10 provides, with a default destination team.
- **Request:** The organization's original problem, requirements, and expected outcome.
- **Project/Job:** An accepted request being delivered by Ethree10.
- **Task:** A unit of work assigned to one or more contributors.
- **Deliverable:** A file, link, document, deployment, campaign, or other reviewable output.
- **Review:** The team head's quality-control decision and feedback.
- **Contribution:** Structured evidence of an individual's work on a task or deliverable.
- **Report:** A weekly or monthly summary generated from operational records.

## 5. Required request brief

Every submitted request should capture:

- Requesting organization
- Contact name and email
- Request title
- Problem or need
- Expected outcome and deliverables
- Requested service/category
- Priority or urgency
- Desired deadline
- Supporting files, links, and brand assets
- Success or acceptance criteria
- Budget information only when commercially necessary
- Consent to receive tracking and delivery emails

The agency should be able to request clarification before accepting and assigning the work.

## 6. Canonical workflow

1. An organization submits a request.
2. The system creates a request code and secure tracking link.
3. The request is routed to the appropriate team head based on service/category.
4. The team head reviews the brief, requests clarification if needed, and accepts or rejects it.
5. An accepted request becomes a project/job with a target delivery date.
6. The team head creates or approves tasks and assigns suitable personnel.
7. Team members record progress, collaboration, blockers, effort, and deliverables.
8. Contributors submit completed work for internal review.
9. The team head approves it or returns it with revision notes.
10. Approved work is delivered to the requester and the requester is notified.
11. The requester accepts the delivery or requests changes.
12. Accepted work is closed and included in organizational, team, and individual reports.

### Recommended request/project states

- Submitted
- Needs Clarification
- Under Review
- Accepted
- Planned
- In Progress
- Blocked
- Internal Review
- Revisions Required
- Approved for Delivery
- Delivered
- Client Changes Requested
- Client Accepted
- Closed
- Rejected
- Cancelled

The UI can show a simplified client-facing status while retaining the detailed internal state.

## 7. Assignment and workload management

Team heads need enough information to assign work responsibly:

- Team and professional discipline
- Relevant skills
- Current active task count
- Estimated and logged effort
- Upcoming deadlines
- Overdue assignments
- Availability or leave status
- Existing blockers
- Recent delivery performance

Assignment should support multiple contributors. A project may have an accountable lead while several people receive explicit credit for their contributions.

## 8. Review and quality control

The system should distinguish between:

- A contributor marking a task ready for review
- A team head approving the internal work
- Ethree10 delivering the work to the requester
- The requester accepting the delivery

Every review should retain:

- Reviewer
- Decision
- Date and time
- Feedback
- Deliverables reviewed
- Revision number
- Resubmission history

Certain service types may require specialist review. For example, a software request may require testing before team-head approval.

## 9. Individual contribution reporting

Individual effort must be derived from structured operational data rather than manually mentioning names at report time.

Record the following for each contributor:

- Tasks assigned, completed, and overdue
- Role played on each project
- Deliverables created or reviewed
- Estimated and logged effort
- Review outcomes and revision cycles
- Support or collaboration contributions
- Blockers raised and resolved
- Completion timeliness
- Team-head narrative or commendation

This makes contributions visible without reducing performance to hours alone.

## 10. Weekly and monthly reports

### Agency report

- Requests received, accepted, rejected, and completed
- Work in progress and awaiting review
- Overdue and blocked work
- Average response and delivery times
- Work volume by organization and team
- Notable outcomes, risks, and escalations

### Team report

- New and completed projects
- Current workload
- Work awaiting assignment or review
- Deadline performance
- Revisions and quality issues
- Contributions by each team member
- Blockers and support required

### Individual report

- Projects supported
- Tasks and deliverables completed
- Contribution narrative
- Timeliness and review outcomes
- Collaboration and support work
- Current workload and blockers

### Organization report

- Requests submitted
- Current request status
- Delivered and accepted work
- Outstanding clarifications or approvals
- Turnaround time and service history

Reports should be generated automatically, reviewed by the appropriate leader, and then finalized. Historical reports must remain immutable after finalization or preserve an audit trail of amendments.

## 11. Notifications

Notify the relevant people when:

- A request is submitted
- Clarification is requested or supplied
- A request is accepted, rejected, or assigned
- A task is assigned, reassigned, blocked, or overdue
- Work is submitted for review
- A review is approved or returned for revision
- Work is delivered
- The client accepts or requests changes
- A weekly or monthly report is ready for review

Email is appropriate for external requesters. In-app and email preferences can be used for staff.

## 12. Security and governance

The following are release requirements:

- One organization must never access another organization's data.
- Public tracking tokens must be unguessable, revocable, and excluded from logs.
- Internal comments and review notes must never appear on public tracking pages.
- Team members should only modify assigned or permitted work.
- Team heads should only control their own teams unless given agency-wide authority.
- Important assignment, status, review, and delivery events must be audited.
- File downloads must respect the same organization and visibility rules as records.

Automated cross-organization isolation tests are mandatory before production launch.

## 13. Scope prioritization

### Core MVP

- Organization-based request intake
- Service catalog and team routing
- Team-head triage and assignment
- Projects, tasks, and contributors
- Workload visibility
- Deliverables and internal review
- Client tracking and communication
- Client delivery acceptance
- Weekly/monthly reporting
- Notifications, permissions, and audit history

### Secondary modules

- Proposals
- Invoices, online payments, and receipts
- Plane integration
- CMS and marketing analytics
- Sponsorships
- Advanced scorecards

Keep existing secondary modules where they are useful, but do not allow them to delay stabilization of the core delivery workflow.

## 14. Recommended implementation sequence

### Phase 1 — Foundation cleanup

- Repair repository health and establish a clean source of truth.
- Complete the workspace-to-organization migration.
- Remove obsolete workspace selection and scoping code.
- Seed the two Ethree10 teams and configurable positions.
- Finalize the permission matrix and canonical statuses.

### Phase 2 — Core delivery workflow

- Complete request intake and service-based routing.
- Implement team-head triage, acceptance, assignment, and reassignment.
- Add workload and deadline visibility.
- Add deliverables, review decisions, revision history, and delivery approval.

### Phase 3 — Client experience

- Complete secure tracking links.
- Add safe client conversations and email notifications.
- Add client acceptance and change-request actions.
- Preserve organization-specific request history.

### Phase 4 — Reporting and accountability

- Capture structured individual contributions.
- Generate agency, team, individual, and organization reports.
- Add leader review and report finalization.
- Validate report calculations against real operating scenarios.

### Phase 5 — Production hardening

- Add authorization and organization-isolation tests.
- Complete typecheck, unit, integration, and E2E suites.
- Add monitoring, backups, rate limiting, and incident procedures.
- Pilot with both Ethree10 teams before wider organization onboarding.

## 15. Decisions required before implementation continues

1. Who serves as the head of each team, and can there be deputies?
2. Which services belong to each team?
3. Can one request require both teams?
4. Who performs final approval when both teams contribute?
5. Must clients formally accept every delivery?
6. What constitutes an overdue request or task?
7. Is effort measured through time logs, estimates, contribution notes, or a combination?
8. Which report metrics will leadership use for evaluation?
9. Are invoices and payments required for the first operational launch?
10. Should external clients remain link-only, or will some organizations require accounts later?

These decisions should be recorded before adding more feature modules.
