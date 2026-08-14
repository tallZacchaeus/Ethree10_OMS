# Plan — service-based assignment with branch-head approval

**Status:** step 1 complete (assignment restricted to the project's branch). Steps 2–5 outstanding — see §7.
**Date:** 2026-08-14

Three things, in one flow:

1. **State who can handle what.** An explicit record of which people can deliver
   which services.
2. **Propose an assignee automatically.** When a task is created for a service,
   the system suggests the person who should do it.
3. **Require the branch head to approve.** Nothing is actually assigned until the
   branch head says so.

---

## 1. What is already here

More than you would expect, which changes the shape of the work.

| Existing | Where | Use |
|---|---|---|
| `Skill` + `UserSkill` (with proficiency level) | `schema.prisma` | Skills exist but are **not linked to services** |
| `tasks.candidates` — ranks people by skills **and current open load** | `task.ts:137` | Most of a suggester already written |
| `Service` with `teamId`, `requiredReviews`, SLA and urgency defaults | `schema.prisma` | Services already know their branch |
| Branch-membership validation on contributors | `execution.ts:45` | The exact check assignment is missing |
| Notification kinds + audience helper | `notification-audience.ts` | Proposal/approval notices plug straight in |

So this is mostly wiring existing parts together, plus one new mapping table and
one approval step.

## 2. The gap this has to close on the way

**Closed in step 1.** `TaskService.assign` now checks the assignee, and
`checkAssignmentEligibility` in `server/services/assignment-eligibility.ts` holds
the rule as a pure function so it is exhaustively unit-tested in CI. What follows
describes the state before that.

**`TaskService.assign` validated nothing.** It loads the task and writes
`assigneeUserId` (`task.ts:375`). It never checks the assignee is in the branch,
in the department, or even on staff. The assignee picker only *suggests* the
department's people — the constraint is presentation, not enforcement.

Two consequences:

- A branch head can already assign work to anyone in the agency, including
  people in the other branch, by calling the endpoint directly.
- **Approval-gated assignment is worth nothing while this is open.** Anything
  built on top can be bypassed by the endpoint underneath it. Closing this is
  step 1, not a footnote.

`setContributors` already does it correctly and is the model to copy:

```ts
// execution.ts — rejects anyone not an active member of the project's branch
throw new TRPCError({
  code: "BAD_REQUEST",
  message: "Every contributor must be an active member of the project team.",
});
```

Two smaller issues in the same area: `candidates` is scoped to a single
**department** rather than the branch, and it excludes `department_lead`, so a
department lead can never be suggested as an assignee.

## 3. A task does not currently know its service

`Service` is attached to the **Request**, and a Task reaches it only through
`task.project.request.service`. That is fine when a project delivers one kind of
work and wrong as soon as it does not — a website project with a launch video
has tasks belonging to two different services, and every one of them would
resolve to whichever service the original request named.

Since assignment is per task, capability has to be matched per task. **Add
`Task.serviceId`**, defaulting to the request's service when a task is created,
and overridable.

---

## 4. Data model

### 4.1 Who can handle what

```prisma
/// An explicit statement that a person can deliver a service. Explicit rather
/// than inferred from skills: "can handle Video Production" is a decision a
/// lead makes, not something to guess from a skill list, and it is the record
/// an assignment is justified against later.
model ServiceCapability {
  id        String       @id @default(cuid())
  userId    String
  serviceId String
  level     SkillLevel   @default(intermediate)
  /// Cleared rather than deleted, so past assignments stay explicable.
  revokedAt DateTime?
  createdAt DateTime     @default(now())
  createdById String?

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  service Service @relation(fields: [serviceId], references: [id], onDelete: Cascade)

  @@unique([userId, serviceId])
  @@index([serviceId, revokedAt])
}
```

Reuses `SkillLevel`, so capability and skills speak the same language.

**Seeding it:** rather than asking leads to fill in a blank matrix, offer a
one-time suggestion pass — for each service, propose the people whose existing
skills match, for a lead to confirm. Skills stay what a person *knows*;
capability is what they are *cleared to deliver*.

### 4.2 The assignment itself

A separate table rather than more columns on `Task`, so a rejected proposal and
its reason survive:

```prisma
model TaskAssignment {
  id          String                 @id @default(cuid())
  taskId      String
  assigneeId  String
  status      TaskAssignmentStatus   @default(proposed)
  /// system when auto-proposed, otherwise the lead who proposed it.
  proposedById String?
  proposedAt   DateTime              @default(now())
  decidedById  String?
  decidedAt    DateTime?
  decisionNote String?
  /// Why this person: capability, load and skills at the time of proposing.
  rationale    Json?

  task     Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  assignee User @relation(fields: [assigneeId], references: [id])

  @@index([taskId, status])
  @@index([assigneeId, status])
}

enum TaskAssignmentStatus {
  proposed
  approved
  rejected
  superseded
}
```

`Task.assigneeUserId` stays as it is and remains the single answer to "who is
doing this" — it is written **only** when an assignment is approved. Every
existing query keeps working.

`rationale` matters more than it looks: six months on, "why was this given to
them" is answerable from the record rather than reconstructed.

---

## 5. The flow

```
task created (with serviceId)
        │
        ├─ capable people?  ServiceCapability for that service, in that branch
        │        │
        │        ├─ none  → no proposal; the task waits for a manual one
        │        └─ some  → rank: level desc, open load asc, hours remaining asc
        │
        ├─ TaskAssignment(proposed) for the top candidate
        ├─ notify the branch head: an assignment needs approval
        │
        ├─ branch head approves → Task.assigneeUserId set
        │                       → notify assignee (existing task_assigned)
        │
        └─ branch head rejects with a note, or picks someone else
                                → that proposal is rejected, a new one proposed
```

**Ranking** extends `candidates`, which already computes open task count and
estimated hours remaining. Capability becomes the first sort key, then load.

**Who does what**

| Action | Who |
|---|---|
| Propose (auto or manual) | system, `department_lead`, `branch_head`, `agency_admin`, COO |
| **Approve or reject** | `branch_head` of the project's branch, `agency_admin`, COO |
| Record capability | `branch_head`, `agency_admin`, COO (reuses `member.updateSkills`) |

A new `task.assignmentApprove` action, held by branch leads. `task.assign` comes
to mean *propose*; approval is the separate, narrower permission. The Chief
Executive is deliberately absent — it holds no delivery writes.

**Can the assignee start before approval?** No. A proposed assignment does not
set `assigneeUserId`, so the task does not appear in anyone's My Work and cannot
be moved to `in_progress`. Approval that does not gate anything is theatre, and
work started before approval is work the branch head cannot really refuse.

---

## 6. Files to change

**Schema and data**
- `prisma/schema.prisma` — `ServiceCapability`, `TaskAssignment`,
  `TaskAssignmentStatus`, `Task.serviceId`, back-relations
- one migration (`pnpm db:migrate`; note the local history caveat in CLAUDE.md)
- `prisma/seed.ts` — sample capabilities so the flow is exercisable locally

**Authorization**
- `server/auth/permissions.ts` — `task.assignmentApprove`; `task.assign` retained
  as propose
- `server/auth/role-groups.ts` — no new group expected; branch leads already exist

**Services**
- `server/services/task.ts` — **validate the assignee** (the §2 gap); split
  `assign` into propose/approve; widen `candidates` to the branch and include
  `department_lead`; rank by capability
- `server/services/assignment.ts` — **new**: propose, approve, reject, supersede;
  audit each
- `server/services/capability.ts` — **new**: grant, revoke, list, suggest-from-skills

**Routers**
- `server/trpc/routers/tasks.ts` — propose/approve/reject endpoints
- `server/trpc/routers/services.ts` — capability management

**UI**
- assignee picker — show capability, load, and *why* someone is suggested
- a branch-head approval surface (fits `/team/assignments`)
- a capability matrix per service, on the service or people screen
- pending-approval state on the task

**Notifications** — three kinds, following the pattern just built:
`assignment_proposed` (branch head), `assignment_approved` (assignee),
`assignment_rejected` (proposer)

**Tests**
- assignment cannot escape the branch (the §2 regression guard)
- proposal does not set `assigneeUserId`; approval does
- ranking prefers capability, then load
- a task with no capable person yields no proposal rather than a bad one

---

## 7. Sequencing

1. **Close the validation gap.** Assignment restricted to the project's branch,
   plus the test. Independently valuable and ships alone.
2. **Capability model.** Table, management endpoints, matrix UI,
   suggest-from-skills. Still no behaviour change to assignment.
3. **Proposal and approval.** `TaskAssignment`, split assign, notifications,
   approval surface. Manual proposals only.
4. **Automatic proposal.** Propose on task creation using capability and load.
5. **Rollout.** Capabilities recorded, then auto-propose enabled.

Steps 1–3 deliver the approval requirement. Step 4 is the automation on top and
is the piece most likely to want tuning once real load data exists.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| **Approval becomes a rubber stamp** that slows delivery | Auto-approve when the branch head proposes it themselves — they have already decided. Approval exists for proposals they did not make. |
| **Nobody is capable of a service**, so nothing is ever proposed | Fall back to a manual proposal and surface it: "no one is recorded as able to deliver X" is a staffing fact worth seeing, not an error to swallow. |
| **Capability matrix goes stale**, so ranking degrades quietly | Suggest-from-skills for the initial pass; surface services with no capable person on the branch dashboard. |
| **Load ranking always picks the same person** early on, before load exists | Rank on capability level first, then load; revisit once there is real data. |
| **The §2 gap is left open** and the approval step is bypassable | Step 1, with a test. Not deferred. |
| Approval blocks urgent work out of hours | Branch head, agency admin and COO can all approve — three people, not one. |

---

## 9. Decisions needed before building

1. **Capability: explicit or inferred?** Planned as explicit, per your "each
   person who can handle a service must be stated", with skills used only to
   suggest the first pass. Inferring from skills alone would be less work and
   less accurate.
2. **Does approval gate the work?** Planned as yes — a proposal does not set
   `assigneeUserId`. The alternative is assign-then-review, which is faster but
   makes the approval advisory.
3. **`Task.serviceId`.** Planned as added, so a project can carry tasks for more
   than one service. Deriving from the request instead is cheaper and wrong for
   mixed projects.
4. **Auto-approve a branch head's own proposal?** Planned as yes.

---

## 10. Explicitly out of scope

**Cross-branch assignment.** Everything here stays within the project's branch,
matching the contributor rule. Assigning across branches is a different question
and needs the inter-branch gap below settled first.

**Inter-branch communication.** There is none today: no channel, no thread, and
`branch_head` and `department_lead` cannot see the other branch's requests or
projects at all, so they cannot comment on them. The only people who see across
both branches hold an agency-wide role. The "Cross-team solution" service is a
routing placeholder — a service with `teamId: null` that stays unrouted until
triaged — not a collaboration mechanism. Worth its own plan if cross-branch work
is a real pattern rather than an occasional hand-off.
