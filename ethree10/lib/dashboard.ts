import type { Role } from "@prisma/client";
import type { BadgeProps } from "@/components/ui/badge";

const REQUESTER_ROLES: Role[] = ["client", "client_viewer"];

type CapacityVariant = NonNullable<BadgeProps["variant"]>;

export function getDashboardExperience(roles: Role[], isSuperAdmin: boolean) {
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const isExecutive = roles.includes("executive");
  // Agency-wide overview surface — admins plus the executive oversight role.
  const isAgencyLead = isAdmin || isExecutive;
  // Operational tiers. The executive is read-only oversight, so it is deliberately excluded
  // from the personal "My work" and department-execution surfaces — it only gets the
  // agency-wide overview above. (Sub-unit lead role was removed; dept leads cover sub-units.)
  const isDeptLead = isAdmin || roles.includes("department_lead");
  const isMember = isDeptLead || roles.includes("member");
  const isRequester = roles.some((role) => REQUESTER_ROLES.includes(role));

  return {
    isAgencyLead,
    isDeptLead,
    isMember,
    isRequester,
    isExecutive,
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
