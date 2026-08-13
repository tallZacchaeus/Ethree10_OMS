import type { Role } from "@prisma/client";
import type { BadgeProps } from "@/components/ui/badge";



type CapacityVariant = NonNullable<BadgeProps["variant"]>;

export function getDashboardExperience(roles: Role[], isSuperAdmin: boolean) {
  // The COO runs operations, so it gets the same agency-wide operational
  // surface as the Agency Admin rather than the executive read-only one.
  const isAdmin =
    isSuperAdmin ||
    roles.includes("agency_admin") ||
    roles.includes("chief_operating_officer");
  // The Chief Executive is oversight: agency-wide read plus budget approval.
  const isExecutive = roles.includes("chief_executive");
  // Finance gets the agency-wide picture too, but framed around money.
  const isFinance = roles.includes("finance_manager");

  // Agency-wide overview surface.
  const isAgencyLead = isAdmin || isExecutive || isFinance;

  // Delivery tiers. The Chief Executive and Finance are deliberately excluded
  // from the personal and team-execution surfaces — neither delivers work, and
  // stacking those panels on top of the agency overview is what made the old
  // admin dashboard unreadable.
  const isBranchHead = isAdmin || roles.includes("branch_head");
  const isDeliveryLead = isBranchHead || roles.includes("department_lead");
  const isMember = isDeliveryLead || roles.includes("team_member");

  return {
    isAgencyLead,
    // Kept as `isTeamHead` for existing consumers; means "leads delivery".
    isTeamHead: isDeliveryLead,
    isBranchHead,
    isMember,
    isExecutive,
    isFinance,
  };
}

export function summarizeThroughput({
  tasksCompletedLast7Days,
  deliveredProjectsLast30Days,
  closedRequestsLast30Days,
}: {
  tasksCompletedLast7Days: number;
  deliveredProjectsLast30Days: number;
  closedRequestsLast30Days: number;
}) {
  return tasksCompletedLast7Days + deliveredProjectsLast30Days + closedRequestsLast30Days;
}

export function getCapacityStatus(
  loadRatio: number | null | undefined,
): { label: string; variant: CapacityVariant } {
  if (loadRatio === null || loadRatio === undefined || Number.isNaN(loadRatio)) {
    return { label: "Unassigned", variant: "neutral" };
  }

  if (loadRatio > 2) {
    return { label: "Overloaded", variant: "destructive" };
  }

  if (loadRatio > 1) {
    return { label: "At Capacity", variant: "warning" };
  }

  return { label: "Healthy", variant: "success" };
}

export function formatPercentage(value: number | null | undefined) {
  const safeValue = value ?? 0;
  return `${Math.round(safeValue * 100)}%`;
}
