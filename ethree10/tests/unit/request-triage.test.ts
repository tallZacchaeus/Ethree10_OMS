import { describe, it, expect } from "vitest";
import { ageInDays, formatAge, isOverdue, nextAction } from "@/lib/request-triage";
import type { RequestStage, Urgency } from "@prisma/client";

const NOW = new Date("2026-09-08T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

const req = (over: Partial<Parameters<typeof nextAction>[0]> = {}) => ({
  stage: "submitted" as RequestStage,
  urgency: "medium" as Urgency,
  routedTeamId: null,
  createdAt: daysAgo(1),
  ...over,
});

describe("age", () => {
  it("counts whole days", () => {
    expect(ageInDays(daysAgo(0), NOW)).toBe(0);
    expect(ageInDays(daysAgo(4), NOW)).toBe(4);
  });

  it("never reports a negative age for a future timestamp", () => {
    // Clock skew between the app server and the database is enough to produce
    // one, and "-1d" in a table looks like a bug in the data.
    expect(ageInDays(new Date(NOW.getTime() + 3_600_000), NOW)).toBe(0);
  });

  it("formats compactly", () => {
    expect(formatAge(daysAgo(0), NOW)).toBe("today");
    expect(formatAge(daysAgo(1), NOW)).toBe("1d");
    expect(formatAge(daysAgo(12), NOW)).toBe("12d");
  });
});

describe("overdue", () => {
  it("holds critical work to a tighter clock than low", () => {
    // The point of per-urgency thresholds: one global number cannot say that a
    // critical request idle for two days is a problem and a low one is not.
    expect(isOverdue(req({ urgency: "critical", createdAt: daysAgo(2) }), NOW)).toBe(true);
    expect(isOverdue(req({ urgency: "low", createdAt: daysAgo(2) }), NOW)).toBe(false);
  });

  it("is not overdue exactly at the threshold", () => {
    expect(isOverdue(req({ urgency: "high", createdAt: daysAgo(3) }), NOW)).toBe(false);
    expect(isOverdue(req({ urgency: "high", createdAt: daysAgo(4) }), NOW)).toBe(true);
  });

  it("does not chase requests nobody is waiting on", () => {
    for (const stage of ["delivered", "closed", "rejected"] as RequestStage[]) {
      expect(isOverdue(req({ stage, urgency: "critical", createdAt: daysAgo(400) }), NOW)).toBe(
        false,
      );
    }
  });
});

describe("next action", () => {
  it("calls out an unrouted request as blocked, not merely submitted", () => {
    // The whole reason this exists: "submitted" is a state, "Assign a branch"
    // is a job, and only the second tells a reader the row is theirs.
    const action = nextAction(req({ stage: "submitted", routedTeamId: null }));
    expect(action.label).toBe("Assign a branch");
    expect(action.tone).toBe("blocked");
  });

  it("distinguishes a routed request at the same stage", () => {
    const action = nextAction(req({ stage: "submitted", routedTeamId: "team_1" }));
    expect(action.label).toBe("Review and scope");
    expect(action.tone).toBe("waiting");
  });

  it("marks work that is waiting on the client rather than on us", () => {
    expect(nextAction(req({ stage: "needs_clarification" })).tone).toBe("blocked");
  });

  it("gives every stage a phrase and a tone", () => {
    const stages: RequestStage[] = [
      "submitted",
      "needs_clarification",
      "pending_approval",
      "under_review",
      "scoping",
      "proposal",
      "approved",
      "in_progress",
      "in_review",
      "delivered",
      "closed",
      "rejected",
      "on_hold",
      "cancelled",
    ];
    for (const stage of stages) {
      const action = nextAction(req({ stage }));
      expect(action.label.length).toBeGreaterThan(0);
      expect(["blocked", "waiting", "active", "done"]).toContain(action.tone);
    }
  });

  it("keeps on_hold visible as blocked rather than settled", () => {
    // On hold still needs somebody to decide something, so it must not read as
    // finished — and it must still age.
    expect(nextAction(req({ stage: "on_hold" })).tone).toBe("blocked");
    expect(isOverdue(req({ stage: "on_hold", urgency: "high", createdAt: daysAgo(9) }), NOW)).toBe(
      true,
    );
  });

  it("settles finished stages as done", () => {
    for (const stage of ["closed", "rejected", "delivered", "cancelled"] as RequestStage[]) {
      expect(nextAction(req({ stage })).tone).toBe("done");
    }
  });
});
