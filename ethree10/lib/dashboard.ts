import type { Role } from "@prisma/client";
import type { BadgeProps } from "@/components/ui/badge";

const REQUESTER_ROLES: Role[] = ["client", "client_viewer"];

type CapacityVariant = NonNullable<BadgeProps["variant"]>;

export function getDashboardExperience(roles: Role[], isSuperAdmin: boolean) {
  // `executive` is agency-wide oversight (read-first), so it shares the agency-lead view.
  const isAgencyLead =
    isSuperAdmin || roles.includes("admin") || roles.includes("executive");
  const isDeptLead = isAgencyLead || roles.includes("department_lead");
  // Sub-unit lead role was removed; department leads cover sub-units. Kept for return shape.
  const isSubUnitLead = isDeptLead;
  const isMember = isSubUnitLead || roles.includes("member");
  const isRequester = roles.some((role) => REQUESTER_ROLES.includes(role));

  return {
    isAgencyLead,
    isDeptLead,
    isSubUnitLead,
    isMember,
    isRequester,
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
