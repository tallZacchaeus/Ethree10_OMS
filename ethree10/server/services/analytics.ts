import type { RequestStage } from "@prisma/client";

/**
 * A single request stage-transition event, as stored in `RequestStageEvent`.
 * `toStage` is the stage the request entered at `createdAt`; the request creation
 * itself records a `toStage: "submitted"` event, so each request has a complete
 * chronological chain.
 */
export interface StageEventInput {
  requestId: string;
  toStage: RequestStage;
  createdAt: Date;
}

export interface BottleneckRow {
  /** Human-readable transition label, e.g. "Submitted → Under Review". */
  stage: string;
  /** Average days a request dwells in the source stage before this transition. */
  avgDays: number;
}

const STAGE_LABELS: Record<RequestStage, string> = {
  submitted: "Submitted",
  pending_approval: "Pending Approval",
  under_review: "Under Review",
  scoping: "Scoping",
  proposal: "Proposal",
  approved: "Approved",
  in_progress: "In Progress",
  in_review: "In Review",
  delivered: "Delivered",
  closed: "Closed",
  rejected: "Rejected",
  on_hold: "On Hold",
  cancelled: "Cancelled",
};

/** Canonical lifecycle order, used to sort the bottleneck rows for display. */
const STAGE_ORDER: RequestStage[] = [
  "submitted",
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

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * Compute average dwell time per stage transition from raw stage events.
 *
 * For each request, events are ordered chronologically and the gap between two
 * consecutive events is attributed to the earlier event's stage — i.e. how long
 * the request sat in `prev.toStage` before moving to `curr.toStage`. Durations are
 * averaged across all requests per transition and returned in lifecycle order.
 *
 * Pure function (no DB / clock access) so it is unit-testable in isolation.
 */
export function computeBottlenecks(events: StageEventInput[]): BottleneckRow[] {
  const byRequest = new Map<string, StageEventInput[]>();
  for (const event of events) {
    const arr = byRequest.get(event.requestId) ?? [];
    arr.push(event);
    byRequest.set(event.requestId, arr);
  }

  const totals = new Map<
    string,
    { fromStage: RequestStage; toStage: RequestStage; totalMs: number; count: number }
  >();

  for (const requestEvents of Array.from(byRequest.values())) {
    const ordered = [...requestEvents].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    );
    for (let i = 1; i < ordered.length; i++) {
      const prev = ordered[i - 1];
      const curr = ordered[i];
      if (!prev || !curr) continue;
      const ms = curr.createdAt.getTime() - prev.createdAt.getTime();
      if (ms < 0) continue; // guard against out-of-order / clock issues
      const key = `${prev.toStage}->${curr.toStage}`;
      const agg =
        totals.get(key) ??
        { fromStage: prev.toStage, toStage: curr.toStage, totalMs: 0, count: 0 };
      agg.totalMs += ms;
      agg.count += 1;
      totals.set(key, agg);
    }
  }

  return Array.from(totals.values())
    .sort((a, b) => STAGE_ORDER.indexOf(a.fromStage) - STAGE_ORDER.indexOf(b.fromStage))
    .map((agg) => ({
      stage: `${STAGE_LABELS[agg.fromStage]} → ${STAGE_LABELS[agg.toStage]}`,
      avgDays: Math.round((agg.totalMs / agg.count / MS_PER_DAY) * 10) / 10,
    }));
}
