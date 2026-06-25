import { Badge, type BadgeProps } from "@/components/ui/badge";

type Variant = NonNullable<BadgeProps["variant"]>;

const REQUEST_STAGE: Record<string, { label: string; variant: Variant }> = {
  submitted: { label: "Submitted", variant: "neutral" },
  under_review: { label: "Under review", variant: "info" },
  scoping: { label: "Scoping", variant: "info" },
  proposal: { label: "Proposal", variant: "info" },
  approved: { label: "Approved", variant: "success" },
  in_progress: { label: "In progress", variant: "default" },
  in_review: { label: "In review", variant: "warning" },
  delivered: { label: "Delivered", variant: "success" },
  closed: { label: "Closed", variant: "secondary" },
  rejected: { label: "Rejected", variant: "destructive" },
  on_hold: { label: "On hold", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

const TASK_STATUS: Record<string, { label: string; variant: Variant }> = {
  todo: { label: "To do", variant: "neutral" },
  in_progress: { label: "In progress", variant: "default" },
  blocked: { label: "Blocked", variant: "destructive" },
  in_review: { label: "In review", variant: "warning" },
  done: { label: "Done", variant: "success" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

const PROJECT_STATUS: Record<string, { label: string; variant: Variant }> = {
  active: { label: "Active", variant: "default" },
  in_review: { label: "In review", variant: "warning" },
  delivered: { label: "Delivered", variant: "success" },
  closed: { label: "Closed", variant: "secondary" },
  on_hold: { label: "On hold", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

const LEAD_STATUS: Record<string, { label: string; variant: Variant }> = {
  new: { label: "New", variant: "info" },
  contacted: { label: "Contacted", variant: "warning" },
  converted: { label: "Converted", variant: "success" },
  rejected: { label: "Rejected", variant: "destructive" },
};

const INVOICE_STATUS: Record<string, { label: string; variant: Variant }> = {
  draft: { label: "Draft", variant: "neutral" },
  sent: { label: "Sent", variant: "info" },
  paid: { label: "Paid", variant: "success" },
  overdue: { label: "Overdue", variant: "destructive" },
  void: { label: "Void", variant: "secondary" },
};

const MAPS = {
  request: REQUEST_STAGE,
  task: TASK_STATUS,
  project: PROJECT_STATUS,
  lead: LEAD_STATUS,
  invoice: INVOICE_STATUS,
} as const;

export function StatusPill({
  kind,
  value,
}: {
  kind: keyof typeof MAPS;
  value: string;
}) {
  const entry = MAPS[kind][value] ?? { label: value, variant: "neutral" as Variant };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
