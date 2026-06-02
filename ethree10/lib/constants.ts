export const PROJECT_TYPES = [
  "Website",
  "Mobile App",
  "Brand Identity",
  "Marketing Campaign",
  "Internal Tool",
  "Bug Fix",
  "Other",
] as const;

export const URGENCIES = ["low", "medium", "high", "critical"] as const;

export const REQUEST_STAGES = [
  "submitted",
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
] as const;

export const TASK_STATUSES = [
  "todo",
  "in_progress",
  "blocked",
  "in_review",
  "done",
  "cancelled",
] as const;

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
