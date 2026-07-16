# Ethree10 OMS — Application Page Map

**Status:** Proposed information architecture  
**Prepared:** 16 July 2026  
**Assumption:** External requesters initially use secure tracking links; authenticated application access is for Ethree10 staff.

## Page classification

- **Core:** Required for the first dependable operational release.
- **Supporting:** Valuable after the core workflow is stable.
- **Optional:** Commercial or administrative capability that can be deferred.
- **Future:** Not required for the initial link-based client experience.

## 1. Public and requester pages

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/` | Home | Explain Ethree10 and direct organizations to submit requests | Core |
| `/about` | About Ethree10 | Present the agency, its two teams, and operating approach | Supporting |
| `/services` | Services | Show services grouped by Product Development and Brands & Communications | Core |
| `/services/[slug]` | Service details | Explain deliverables, expected inputs, timelines, and destination team | Supporting |
| `/contact` | General enquiry | Capture non-project questions as leads | Supporting |
| `/request` | Submit a request | Collect the organization, contact, brief, files, deadline, and service | Core |
| `/request/success` | Request confirmation | Show request code, tracking link, and next steps | Core |
| `/track/[token]` | Request tracking | Show safe status, public timeline, deliverables, and conversation | Core |
| `/track/[token]/accept` | Delivery acceptance | Let the requester accept delivery or request changes | Core |
| `/invoice/[code]` | Public invoice | View/download an invoice and initiate payment | Optional |
| `/receipt/[code]` | Public receipt | View/download a receipt | Optional |
| `/login` | Staff login | Authenticate Ethree10 personnel | Core |
| `/magic-link-sent` | Login confirmation | Confirm that a staff login link was sent | Core |
| `/privacy` | Privacy notice | Explain request, tracking, analytics, and file handling | Core |
| `/terms` | Terms of service | Set service and acceptable-use terms | Supporting |

Public tracking pages must be `noindex` and expose only explicitly whitelisted client-safe fields.

## 2. Shared authenticated staff pages

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/dashboard` | My dashboard | Show assignments, deadlines, review feedback, blockers, and recent activity | Core |
| `/inbox` | Inbox | Centralize assignments, mentions, reviews, and system notifications | Core |
| `/requests` | Request register | Search and filter all requests the user may access | Core |
| `/requests/new` | Internal request | Let staff create a request on behalf of an organization | Supporting |
| `/requests/[id]` | Request details | Display the brief, organization, routing, timeline, comments, and decision history | Core |
| `/projects` | Project/job register | List accepted work with team, status, owner, and deadline | Core |
| `/projects/[id]` | Project workspace | Coordinate tasks, contributors, deliverables, reviews, and client delivery | Core |
| `/tasks` | My/team tasks | Filter tasks by assignee, team, status, deadline, and priority | Core |
| `/tasks/[id]` | Task details | Record execution, comments, effort, blockers, attachments, and submission | Core |
| `/calendar` | Delivery calendar | Show request, project, task, and review deadlines | Supporting |
| `/notifications` | Notification centre | View and manage operational notifications | Supporting |
| `/profile` | My profile | Manage name, contact, position, skills, timezone, and avatar | Core |
| `/settings/notifications` | Notification preferences | Configure staff delivery channels and digest frequency | Supporting |
| `/settings/security` | Security | Configure MFA and active authentication sessions | Core |

## 3. Team-member pages

Most team-member work can live in shared pages with permission-aware views. Dedicated pages are useful where they simplify daily execution.

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/my-work` | My work | Consolidate assigned projects, tasks, reviews, and deadlines | Core |
| `/my-work/blocked` | My blockers | Record and escalate blocked work | Supporting |
| `/my-contributions` | Contribution history | Show tasks, deliverables, reviews, support work, and report attribution | Core |
| `/timesheets` | Effort log | Review and submit time/effort records when used operationally | Supporting |

## 4. Team-head pages

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/team/dashboard` | Team dashboard | Show intake, workload, deadlines, blockers, reviews, and delivery performance | Core |
| `/team/intake` | Team intake queue | Review requests routed to the team and request clarification | Core |
| `/team/assignments` | Assignment board | Assign and reassign projects/tasks based on discipline and availability | Core |
| `/team/workload` | Workload view | Compare active work, deadlines, estimates, and capacity across members | Core |
| `/team/reviews` | Review queue | Vet submitted work, approve delivery, or require revisions | Core |
| `/team/reviews/[id]` | Review details | Inspect deliverables, test evidence, history, and reviewer feedback | Core |
| `/team/members` | Team directory | View positions, skills, workload, and active membership | Core |
| `/team/services` | Team services | Manage service categories and expected deliverables for the team | Supporting |
| `/team/reports` | Team reports | Generate and review weekly/monthly team reports | Core |
| `/team/reports/[id]` | Team report details | Review metrics, individual contributions, blockers, and narrative | Core |
| `/team/settings` | Team settings | Configure deputies, default routing, review rules, and SLAs | Supporting |

The active team context should come from the staff member's membership and permissions, not from a global workspace switcher.

## 5. Agency leadership pages

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/agency/dashboard` | Agency overview | Compare both teams, organization demand, delivery, risks, and performance | Core |
| `/agency/requests` | Agency request oversight | Inspect intake and escalation across both teams | Core |
| `/agency/projects` | Agency delivery oversight | Track all active and overdue work | Core |
| `/agency/workload` | Agency capacity | Compare workload and capacity between teams | Supporting |
| `/agency/reviews` | Approval/escalation queue | Handle cross-team or escalated review decisions | Supporting |
| `/agency/reports` | Agency reports | Generate and finalize weekly/monthly agency reports | Core |
| `/agency/reports/[id]` | Agency report details | Review team, organization, and individual report sections | Core |
| `/agency/scorecards` | Performance scorecards | Configure and review agreed leadership metrics | Supporting |
| `/agency/skills` | Agency skills directory | Find personnel by discipline and skill | Supporting |

## 6. Organization-management pages

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/organizations` | Organization directory | List sibling initiatives and external clients | Core |
| `/organizations/new` | Add organization | Create an organization manually | Supporting |
| `/organizations/[id]` | Organization overview | Show contacts, requests, projects, invoices, and service history | Core |
| `/organizations/[id]/requests` | Organization requests | Filter the request history for one organization | Core |
| `/organizations/[id]/reports` | Organization reports | View weekly/monthly service reports for one organization | Supporting |
| `/organizations/[id]/contacts` | Organization contacts | Manage requester contacts without granting staff access | Supporting |
| `/organizations/[id]/settings` | Organization settings | Manage branding, archival state, and tracking-link policies | Supporting |

## 7. People and structure administration

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/teams` | Teams | Manage Product Development and Brands & Communications | Core |
| `/teams/[id]` | Team details | Configure leadership, members, services, and review rules | Core |
| `/members` | Staff directory | Manage agency staff and membership status | Core |
| `/members/invite` | Invite staff | Onboard an Ethree10 staff member | Core |
| `/members/[id]` | Staff details | Manage role, position, team, skills, and availability | Core |
| `/positions` | Positions | Configure professional job titles independently of permissions | Core |
| `/skills` | Skills | Manage the agency skill taxonomy | Supporting |
| `/availability` | Availability | Record leave, availability, and capacity adjustments | Supporting |

The existing `departments` concept can become `teams`. Sub-units should only remain if Ethree10 genuinely operates smaller permanent units inside either team.

## 8. Workflow configuration pages

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/settings/services` | Service catalog | Define services, destination teams, brief fields, and expected deliverables | Core |
| `/settings/routing` | Routing rules | Map request categories to teams and fallback leaders | Core |
| `/settings/workflows` | Workflow configuration | Configure permitted status transitions and approval gates | Supporting |
| `/settings/review-rules` | Review rules | Define required reviewers or testing for selected services | Supporting |
| `/settings/reporting` | Reporting configuration | Set periods, cutoffs, metrics, reviewers, and recipients | Core |
| `/settings/templates` | Templates | Manage request, task, notification, and report templates | Supporting |
| `/settings/notifications` | Agency notifications | Configure default event notifications and digests | Supporting |

## 9. Reporting pages

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/reports` | Report centre | Find agency, team, individual, and organization reports | Core |
| `/reports/generate` | Generate report | Start or preview a weekly/monthly report | Core |
| `/reports/[id]` | Report details | Review metrics, contributions, narrative, and approval history | Core |
| `/reports/[id]/edit` | Report review | Let authorized leaders correct narrative before finalization | Core |
| `/reports/[id]/export` | Export report | Download PDF or spreadsheet output | Supporting |
| `/reports/individual/[memberId]` | Individual contribution report | Review one person's work across the selected period | Core |
| `/analytics` | Operational analytics | Explore trends beyond finalized reports | Supporting |

## 10. Commercial pages

These pages already have meaningful implementation, but they are secondary to the core agency workflow.

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/proposals` | Proposals | Manage commercial proposals linked to requests | Optional |
| `/proposals/[id]` | Proposal details | Edit, approve, and send a proposal | Optional |
| `/invoices` | Invoice register | Manage organization/project invoices | Optional |
| `/invoices/new` | New invoice | Create an invoice against an organization/project | Optional |
| `/invoices/[id]` | Invoice details | Send, download, and reconcile an invoice | Optional |
| `/receipts` | Receipt register | Manage automatic and manual receipts | Optional |
| `/sponsorships` | Sponsorships | Manage sponsorship records | Optional |

## 11. Governance and platform administration

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/audit` | Audit log | Inspect sensitive operational and administrative changes | Core |
| `/integrations` | Integrations | Configure Plane and other external services | Optional |
| `/admin/analytics` | Product analytics | Review application usage and adoption | Supporting |
| `/admin/cms` | Marketing CMS | Manage selected public-site content | Optional |
| `/admin/system` | System health | Show worker, queue, email, storage, and webhook health | Supporting |
| `/admin/jobs` | Background jobs | Inspect failed or delayed jobs and retry safely | Supporting |
| `/admin/email` | Email delivery | Inspect templates, delivery events, and failures | Supporting |
| `/settings` | Agency settings | Manage identity, defaults, timezone, and operational preferences | Core |

## 12. Future client portal

Only build this after link-based tracking proves insufficient.

| Route | Page | Purpose | Priority |
|---|---|---|---|
| `/client/dashboard` | Client dashboard | Consolidated organization-level request overview | Future |
| `/client/requests` | Client requests | View all requests belonging to the organization | Future |
| `/client/requests/[id]` | Client request details | Authenticated alternative to a tracking link | Future |
| `/client/projects` | Client projects | View accepted and delivered projects | Future |
| `/client/invoices` | Client invoices | View organization billing history | Future |
| `/client/reports` | Client reports | View finalized organization reports | Future |
| `/client/team` | Client contacts | Manage which organization contacts receive updates | Future |

## 13. Recommended primary navigation

### Team member

- Dashboard
- My Work
- Requests
- Projects
- Tasks
- My Contributions
- Inbox

### Team head

- Team Dashboard
- Intake
- Assignments
- Workload
- Reviews
- Projects
- Team Reports
- Team Members

### Agency executive/admin

- Agency Dashboard
- Requests
- Projects
- Organizations
- Teams
- People
- Reports
- Audit
- Settings

Commercial and administrative modules should appear only for roles that use them.

## 14. Core release page set

The first dependable release does not need every proposed page. Its minimum coherent set is:

1. Public services and request submission
2. Request confirmation and secure tracking
3. Staff login and personal dashboard
4. Request register and request details
5. Team intake and assignment board
6. Project workspace and task details
7. Team workload view
8. Review queue and review details
9. Client delivery acceptance
10. Organization directory and history
11. Team and member administration
12. Weekly/monthly report centre and report details
13. Notification centre
14. Audit log and security settings

This set should be completed and validated before expanding optional commercial or CMS surfaces.
