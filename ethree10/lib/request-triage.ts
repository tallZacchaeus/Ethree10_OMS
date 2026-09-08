import type { RequestStage, Urgency } from "@prisma/client";

/**
 * Turning a request row into the thing a reader actually wants: what happens
 * next, who has it, and whether it has been sitting too long.
 *
 * The requests table showed a code, a title, "Assigned" or "Unassigned", a
 * stage badge and a created date. Every one of those is a fact about the
 * record; none of them answers "which of these needs me today". A stage badge
 * reading `submitted` does not say that nobody has picked it up, and a created
 * date does not say that a critical request has been waiting four days.
 *
 * Pure on purpose — no database, no clock of its own — so the rules can be
 * tested directly rather than inferred from a rendered table.
 */

export type TriageInput = {
  stage: RequestStage;
  urgency: Urgency;
  routedTeamId: string | null;
  createdAt: Date;
};

export type NextAction = {
  label: string;
  /** How much this wants attention. Drives colour without hard-coding one. */
  tone: "blocked" | "waiting" | "active" | "done";
};

/** Whole days a request has been open. */
export function ageInDays(createdAt: Date, now: Date = new Date()): number {
  const ms = now.getTime() - createdAt.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/**
 * How long a request may sit before it is late, by urgency.
 *
 * A critical request untouched for two days is a different situation from a
 * low-priority one untouched for two days, and a single global threshold
 * cannot say so.
 */
const STALE_AFTER_DAYS: Record<Urgency, number> = {
  critical: 1,
  high: 3,
  medium: 7,
  low: 14,
};

/** Stages where nobody is waiting on the agency, so age is not a fault. */
const SETTLED_STAGES: RequestStage[] = ["delivered", "closed", "rejected", "cancelled"];

export function isOverdue(input: TriageInput, now: Date = new Date()): boolean {
  if (SETTLED_STAGES.includes(input.stage)) return false;
  return ageInDays(input.createdAt, now) > STALE_AFTER_DAYS[input.urgency];
}

/**
 * The next thing someone has to do, phrased as that action.
 *
 * "submitted" is a state; "Assign a branch" is a job. The second is what makes
 * a list scannable, because the reader can look for the verb that is theirs.
 */
export function nextAction(input: TriageInput): NextAction {
  switch (input.stage) {
    case "submitted":
      return input.routedTeamId
        ? { label: "Review and scope", tone: "waiting" }
        : { label: "Assign a branch", tone: "blocked" };
    case "needs_clarification":
      return { label: "Waiting on client", tone: "blocked" };
    case "pending_approval":
      return { label: "Approve or reject", tone: "waiting" };
    case "under_review":
      return { label: "Complete review", tone: "waiting" };
    case "scoping":
      return { label: "Agree scope", tone: "active" };
    case "proposal":
      return { label: "Send proposal", tone: "active" };
    case "approved":
      return { label: "Start the project", tone: "waiting" };
    case "in_progress":
      return { label: "Delivery underway", tone: "active" };
    case "in_review":
      return { label: "Review the work", tone: "waiting" };
    case "delivered":
      return { label: "Awaiting close", tone: "done" };
    case "closed":
      return { label: "Closed", tone: "done" };
    case "rejected":
      return { label: "Rejected", tone: "done" };
    case "on_hold":
      return { label: "On hold — needs a decision", tone: "blocked" };
    case "cancelled":
      return { label: "Cancelled", tone: "done" };
    default: {
      // Exhaustiveness: a new stage becomes a type error here rather than
      // silently rendering an empty cell.
      const unreachable: never = input.stage;
      return { label: String(unreachable), tone: "waiting" };
    }
  }
}

/** "4d" / "today" — compact enough for a table column. */
export function formatAge(createdAt: Date, now: Date = new Date()): string {
  const days = ageInDays(createdAt, now);
  if (days === 0) return "today";
  if (days === 1) return "1d";
  return `${days}d`;
}
