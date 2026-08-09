import type { Role } from "@prisma/client";

/**
 * The in-app handbook.
 *
 * One place that explains, for every kind of user: what they can do, what they
 * cannot, what has to be true before a thing will work, and what happens next.
 * Rendered by `/help`, which highlights the reader's own role first.
 *
 * Keep this in step with `server/auth/permissions.ts`. If a permission changes
 * and this file does not, the handbook becomes a lie — which is worse than
 * having no handbook.
 */

export interface HelpStep {
  title: string;
  detail: string;
  /** What must already be true for this step to succeed. */
  requires?: string[];
  /** What the system does once the step completes. */
  then?: string[];
}

export interface HelpSection {
  heading: string;
  body?: string;
  steps?: HelpStep[];
}

export interface RoleGuide {
  role: Role;
  label: string;
  tagline: string;
  /** Who this person is, in one paragraph. */
  summary: string;
  /** Where they should start each day. */
  home: string;
  can: string[];
  cannot: string[];
  sections: HelpSection[];
}

/** Rules that apply to everyone, regardless of role. */
export const UNIVERSAL_RULES: HelpSection[] = [
  {
    heading: "Two rules govern all money",
    body:
      "First, nothing can be invoiced to a client and nothing can be spent on a project until the Chief Executive has approved that project's budget. Second, the person who approves money can never be the person who confirms it moved. Both are enforced by the server, so no screen, shortcut or API call can get around them.",
  },
  {
    heading: "Clients never log in",
    body:
      "External clients have no accounts. They submit a request from the public site and immediately receive a private tracking link. From that link they can see the current stage, follow the full timeline, talk to the team, and accept or reject delivered work. Everything you mark 'client-visible' appears there; internal notes never do.",
  },
  {
    heading: "Requests arrive unclassified",
    body:
      "The public form deliberately does not ask the client to pick a service, set an urgency, or write acceptance criteria — that is the agency's job, not theirs. Every request therefore lands unrouted in the Intake Queue and needs a human to classify it. This makes triage a daily habit rather than an exception.",
  },
  {
    heading: "If a button is missing, the server would have refused anyway",
    body:
      "Screens hide actions you do not have permission for, but hiding is only a convenience. Every action is checked again on the server. If you think you should be able to do something and cannot, it is a role question for your Agency Admin, not a bug.",
  },
];

/** The lifecycle every piece of work follows, end to end. */
export const LIFECYCLE: HelpStep[] = [
  {
    title: "1 · A client submits a request",
    detail:
      "From the public site. They describe what they need in their own words and give a deadline. Name, email, organisation, title, description and expected deliverables are required; phone, supporting links and budget are optional.",
    then: [
      "A client organisation record is created or reused",
      "A private tracking link is generated and shown to them",
      "The request appears in the Intake Queue, unrouted",
    ],
  },
  {
    title: "2 · A lead triages it",
    detail:
      "A branch head, department lead or agency admin opens the Intake Queue, reads what was asked for, sets the service — which routes it to the right branch — and sets the urgency.",
    requires: ["The request is in the Intake Queue", "You can route requests"],
    then: ["The request is routed to a branch", "It appears in that branch's Brief Review"],
  },
  {
    title: "3 · Scope is agreed with the client",
    detail:
      "In the request's conversation thread. Choose 'client-visible' for anything the client should see; use internal notes for everything else. The client replies from their tracking link.",
    then: ["The client is emailed on client-visible replies and stage changes"],
  },
  {
    title: "4 · The request is accepted and becomes a project",
    detail: "Accepting the brief turns the request into a project owned by a branch.",
    requires: ["The brief is complete enough to work from"],
  },
  {
    title: "5 · The budget is submitted and approved",
    detail:
      "A branch head or agency admin submits the project budget: the total, what the client is billed, and what the agency expects to spend. The Chief Executive approves or rejects it.",
    requires: ["The project exists"],
    then: [
      "Approved: Finance can invoice, and leads can request spend",
      "Rejected: it goes back to the branch to revise and resubmit",
    ],
  },
  {
    title: "6 · Work is broken into tasks and assigned",
    detail:
      "Leads create tasks and assign them. Work can start before the budget is approved — only money is gated, never delivery.",
    then: [
      "The assignee is emailed the brief, deadline, priority and a direct link",
      "The task appears in their My Work",
    ],
  },
  {
    title: "7 · The task is done and submitted for review",
    detail:
      "The assignee logs time, attaches deliverables, and submits a completion summary with evidence and hours.",
    requires: ["The task is assigned to you or you are a contributor"],
    then: ["The task moves to 'in review' — it is NOT done yet"],
  },
  {
    title: "8 · A lead reviews it",
    detail:
      "The lead accepts it or sends it back with revisions and a reason. Revisions are recorded and increment the task's revision number.",
    requires: ["The task is 'in review'"],
    then: [
      "Accepted by the branch head, and any required specialist review passed: the task becomes 'done'",
      "Revisions requested: it returns to 'in progress' for the assignee",
    ],
  },
  {
    title: "9 · The project is delivered to the client",
    detail:
      "Only when every task has passed review. This is the first moment the client hears that the work is finished.",
    requires: [
      "Every task is 'done' or 'cancelled'",
      "Every task has branch-head approval",
      "Every specialist review the service requires has passed",
    ],
    then: [
      "The request stage becomes 'delivered'",
      "The client is emailed and can accept or request changes from their link",
    ],
  },
  {
    title: "10 · The client accepts, and it is billed",
    detail:
      "The client accepts delivery, or requests changes — which reopens the affected tasks and increments the delivery revision.",
    then: [
      "Finance sends the invoice (only if the budget is approved)",
      "Finance confirms funds received, which issues the receipt automatically",
    ],
  },
];

export const ROLE_GUIDES: RoleGuide[] = [
  {
    role: "chief_executive",
    label: "Chief Executive",
    tagline: "Sees everything. Approves the money. Does not run delivery.",
    summary:
      "You are the overall head of the agency. Both branches report to you. Your job in this system is deliberately narrow: watch everything, and authorise spending. You do not route or assign work, because each branch head knows their own people better than the top of the org does — your influence on delivery is the comment, not the assignment.",
    home: "Dashboard, then Budget Approvals",
    can: [
      "See every request, project, task, report and audit entry across both branches",
      "Approve or reject any project budget — the only role that can",
      "Comment on any request, project or task",
      "Read invoices and receipts",
      "Generate reports",
    ],
    cannot: [
      "Route requests, assign tasks, or create projects",
      "Approve delivered work",
      "Confirm a payment or pay an expense — even on a budget you approved",
      "Hold the Finance Manager role at the same time as this one",
    ],
    sections: [
      {
        heading: "Approving a budget",
        steps: [
          {
            title: "Open Budget Approvals",
            detail:
              "Everything awaiting a decision is listed oldest first, with the project, client, branch, amount, who submitted it and their note.",
            requires: ["A branch has submitted a budget"],
          },
          {
            title: "Add a note, then approve or reject",
            detail:
              "Your note is permanent and is shown to the submitter. Use it to record why, not just what.",
            then: [
              "Approved: Finance can invoice this project, and leads can request spend against it",
              "Rejected: the submitter is notified and can revise and resubmit",
            ],
          },
        ],
      },
      {
        heading: "Why a budget can come back to you",
        body:
          "Resubmitting a budget always clears the previous approval — the status returns to 'awaiting approval' and the version number increases. Nobody can raise a ceiling you have already signed off without asking you again.",
      },
      {
        heading: "Why you cannot confirm payments",
        body:
          "Approving money and confirming it moved must be two different people, or the approval chain proves nothing in an audit. The system blocks it per transaction, and also refuses to give one person both this role and Finance Manager.",
      },
    ],
  },
  {
    role: "finance_manager",
    label: "Finance Manager",
    tagline: "Moves the money the Chief Executive has authorised.",
    summary:
      "You execute and record every movement of money. You work strictly within budgets the Chief Executive has already approved — you never authorise spending yourself. Receipts, the records used for internal accounts and audits, are created only by you confirming that funds arrived.",
    home: "Invoices, then Expenses",
    can: [
      "Create, send and manage invoices",
      "Confirm funds received, which issues the receipt",
      "Pay approved expenses raised by others",
      "Read across the whole agency for context",
      "Update enquiries and generate reports",
    ],
    cannot: [
      "Approve a project budget",
      "Pay an expense you raised yourself",
      "Route, assign or review delivery work",
      "Hold the Chief Executive role at the same time as this one",
    ],
    sections: [
      {
        heading: "Billing a client",
        steps: [
          {
            title: "Create the invoice against the project",
            detail: "Attach it to the project so it inherits that project's approved budget.",
            requires: ["The project exists"],
          },
          {
            title: "Send it",
            detail: "The client gets a link to a public invoice page — no account needed.",
            requires: [
              "The project's budget is APPROVED — sending is blocked otherwise, with a message telling you the current state",
            ],
          },
          {
            title: "Confirm funds received",
            detail: "Record the payment method and reference once the money has landed.",
            requires: [
              "The budget is approved",
              "You are not the person who approved that budget",
              "The payment has not already been confirmed",
            ],
            then: [
              "The invoice becomes 'paid'",
              "A receipt is issued automatically and gets its own public link",
            ],
          },
        ],
      },
      {
        heading: "Paying an expense",
        steps: [
          {
            title: "Open Expenses",
            detail:
              "Spend requests raised by branch heads and department leads against approved budgets.",
          },
          {
            title: "Pay it",
            detail: "Record a payment reference. The requester is notified.",
            requires: [
              "The project's budget is approved",
              "You did not raise this request yourself",
            ],
          },
        ],
      },
      {
        heading: "When something is blocked",
        body:
          "Every refusal explains itself. 'The budget for this project is submitted' means it is waiting on the Chief Executive. 'You approved this project's budget' means a second person has to confirm the payment. These are controls, not faults — do not route around them with a shared account.",
      },
    ],
  },
  {
    role: "agency_admin",
    label: "Agency Admin",
    tagline: "Runs operations and configuration. Never touches the money.",
    summary:
      "You keep the agency's structure and settings correct and usable: people, branches, departments, the service catalogue, integrations and the marketing site. You also have full delivery authority. What you deliberately do not have is money power — an admin who can restructure the agency and move its funds would be a single point of failure.",
    home: "Dashboard",
    can: [
      "Invite staff and change roles, positions, branches and departments",
      "Create and archive branches and departments",
      "Manage the service catalogue, integrations and marketing site content",
      "Route, assign, review and close work anywhere in the agency",
      "Submit budgets and request spend",
    ],
    cannot: [
      "Approve a budget",
      "Confirm a payment or issue a receipt",
      "Pay an expense",
      "Assign someone both Chief Executive and Finance Manager",
    ],
    sections: [
      {
        heading: "Setting the agency up",
        steps: [
          {
            title: "Confirm both branches exist",
            detail: "Digital Media, and Tech & Product. Assign a branch head to each.",
          },
          {
            title: "Create the departments",
            detail:
              "Inside each branch, and give each one a department lead. Departments are yours to shape — create, rename and archive them as the agency changes.",
          },
          {
            title: "Add people",
            detail: "Set each person's role, branch, department, position and skills.",
            requires: ["The branch and department exist first"],
          },
          {
            title: "Review the service catalogue",
            detail:
              "Every service needs a destination branch, an SLA, and any specialist reviews it requires. Keep one fallback for unclear requests.",
            then: ["Leads can classify incoming requests quickly and consistently"],
          },
        ],
      },
      {
        heading: "A role assignment the system will refuse",
        body:
          "You cannot give one person both Chief Executive and Finance Manager. Both the invite and the role change will fail with an explanation. This is separation of duties. If the same human really does both jobs today, that is an organisational risk to raise, not a setting to override.",
      },
    ],
  },
  {
    role: "branch_head",
    label: "Branch Head",
    tagline: "Runs one arm of the agency and everything inside it.",
    summary:
      "You head Digital Media or Tech & Product, and every department within it. You report to the Chief Executive. Most of the quality of the agency's output is decided by how well you triage: requests now arrive as raw client wishes, and turning them into well-scoped, well-routed, well-assigned work is your job.",
    home: "Branch Dashboard, then Intake Queue",
    can: [
      "Classify, route, accept, reject and re-route requests",
      "Create and archive departments in your branch, and assign their leads",
      "Create projects, create and assign tasks",
      "Review delivered work and request revisions",
      "Submit project budgets and request spend",
      "Manage the service catalogue",
    ],
    cannot: [
      "Approve any budget, including your own submissions",
      "Confirm payments or pay expenses",
      "Act outside your own branch",
    ],
    sections: [
      {
        heading: "Triage — the step that matters most",
        body:
          "Clients no longer choose a service or an urgency. They describe what they want; you decide what it is. Do this daily.",
        steps: [
          {
            title: "Open the Intake Queue",
            detail:
              "Anything marked 'Needs routing' has never been classified. The requester and their organisation are shown so you know who is asking.",
          },
          {
            title: "Set the service and urgency",
            detail:
              "Choosing the service routes the request to the right branch. If it belongs to the other branch, re-route it.",
            then: ["It moves into that branch's Brief Review"],
          },
          {
            title: "Agree the scope in the thread",
            detail:
              "Ask the client what you still need. Use client-visible replies for anything they should see; keep internal notes internal.",
            then: ["The client is emailed and can reply from their tracking link"],
          },
          {
            title: "Accept it",
            detail: "This turns the request into a project you own.",
          },
        ],
      },
      {
        heading: "Getting a project funded",
        steps: [
          {
            title: "Submit the budget",
            detail:
              "Give the total, what the client is billed, and what you expect to spend internally. The internal amount becomes the ceiling for all spend requests.",
            requires: ["The project exists"],
            then: ["Every Chief Executive is notified"],
          },
          {
            title: "Wait for the decision",
            detail:
              "You cannot approve your own budget. Work can continue meanwhile — only money is gated.",
            then: [
              "Approved: Finance can invoice, and you can request spend",
              "Rejected: revise and resubmit; the version number increases",
            ],
          },
        ],
      },
      {
        heading: "Assigning work well",
        body:
          "Check Workload before you assign — it is calculated from real estimates and logged hours, not self-reports. The moment you assign someone, they are emailed the brief, project, priority, deadline, estimated effort and acceptance criteria, with a direct link. Re-saving a task does not re-notify; only a real change of assignee does.",
      },
      {
        heading: "Delivering to the client",
        body:
          "Delivery is blocked until every task is done or cancelled, every task has branch-head approval, and every specialist review the service requires has passed. This is why the client never hears that work is finished before you have signed it off.",
      },
    ],
  },
  {
    role: "department_lead",
    label: "Department Lead",
    tagline: "Runs one department's delivery.",
    summary:
      "You lead a department inside a branch — Engineering inside Tech & Product, or Video & Photography inside Digital Media, for example. You report to your branch head. Your focus is the flow of your department's work: who is doing what, whether they are overloaded, and whether what they produce is good enough to go up.",
    home: "Branch Dashboard, then Assignments",
    can: [
      "Assign and re-assign your department's work",
      "Review submitted work and request revisions",
      "Create and update projects your department owns",
      "Move requests along their lifecycle",
      "Request spend against approved budgets",
      "Update your department's details",
    ],
    cannot: [
      "Create or archive departments, or restructure the branch",
      "Manage the service catalogue",
      "Approve budgets or pay anything",
      "Route requests to a different branch",
    ],
    sections: [
      {
        heading: "Keeping work moving",
        steps: [
          {
            title: "Check Workload first",
            detail:
              "Real capacity from estimates, logged hours, leave and blockers. Assigning into an overloaded person is the most common cause of a missed deadline.",
          },
          {
            title: "Assign the task",
            detail: "The person is emailed everything they need to start immediately.",
            then: ["The task appears in their My Work"],
          },
          {
            title: "Answer their questions",
            detail:
              "When someone asks for clarification, you are emailed. A task waiting on an answer is flagged as blocked so it is visible rather than silently stalled — clear the flag once you have answered.",
          },
          {
            title: "Review what they submit",
            detail:
              "Accept it, or send it back with a reason. Revisions are recorded and auditable; that is the point of them.",
            requires: ["The task is 'in review'"],
          },
        ],
      },
    ],
  },
  {
    role: "team_member",
    label: "Team Member",
    tagline: "Does the work.",
    summary:
      "You deliver. Your app is deliberately small — most days you will use My Work and nothing else. You do not have to hunt for what you have been given: you are emailed the moment work is assigned to you.",
    home: "My Work",
    can: [
      "See and work the tasks assigned to you",
      "Log time and attach deliverables",
      "Submit completed work for review",
      "Ask your lead or the client for clarification",
      "Comment on tasks and requests",
      "Raise a new request on behalf of a client",
    ],
    cannot: [
      "Assign work to yourself or anyone else",
      "Approve or review work",
      "See invoices, receipts, budgets or the audit log",
      "Mark your own task 'done' — a lead decides that",
    ],
    sections: [
      {
        heading: "Working a task",
        steps: [
          {
            title: "Open it from your email or My Work",
            detail:
              "The email already contains the brief, project, priority, deadline, estimated effort and acceptance criteria.",
          },
          {
            title: "Move it to 'in progress' and log time as you go",
            detail:
              "Logging time is what keeps Workload honest for everyone, and it feeds your own contribution record.",
          },
          {
            title: "Attach deliverables",
            detail: "Add versions as you produce them so the review has something concrete to look at.",
          },
          {
            title: "Submit for review",
            detail: "Include a summary of what you did, evidence or a link, and the hours spent.",
            requires: ["The task is assigned to you, or you are a contributor on it"],
            then: [
              "The task moves to 'in review' — it is not done yet",
              "Your lead is notified",
            ],
          },
        ],
      },
      {
        heading: "When you need clarity",
        body:
          "Use 'Need clarity?' on the task. 'Ask my lead' emails your department lead, branch head and the assignee. 'Ask the client' posts the question on the requester's tracking link and emails them. Either way the task is flagged as waiting, so nobody assumes you are just slow.",
      },
      {
        heading: "What happens after you submit",
        body:
          "Your lead either accepts it or sends it back with a reason. Revisions are normal. The client is not told anything about individual tasks — they only hear when the whole project is delivered, and that only happens once every task has passed review.",
      },
    ],
  },
  {
    role: "super_admin",
    label: "Super Admin",
    tagline: "Technical owner. Not an operational role.",
    summary:
      "This is the platform escape hatch, granted directly on the user record rather than handed out from the People screen. It bypasses every permission check, which means it also bypasses the money controls. Use a proper operational role for day-to-day work and keep this for genuine platform administration.",
    home: "Dashboard",
    can: ["Everything, on every screen, in every branch"],
    cannot: [
      "Nothing is blocked — which is exactly why this should not be anyone's everyday account",
    ],
    sections: [
      {
        heading: "A warning worth reading",
        body:
          "Because super admin short-circuits permission checks, it can approve a budget and confirm its own payment. The separation-of-duties controls that protect everyone else do not protect you. Do the finance work from a real Chief Executive or Finance Manager account so the audit trail means something.",
      },
    ],
  },
];

export function guideForRole(role: Role): RoleGuide | undefined {
  return ROLE_GUIDES.find((guide) => guide.role === role);
}
