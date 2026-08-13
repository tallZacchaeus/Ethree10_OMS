"use client";

import { trpc } from "@/lib/trpc/client";
import type { Role } from "@prisma/client";

/** Current staff authorization context. Ethree10 is one agency; there is no workspace switcher. */
export function useAgencyContext() {
  const { data: user } = trpc.auth.me.useQuery();
  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const memberships = user?.memberships ?? [];
  const roles = memberships.map((membership: { role: string }) => membership.role as Role);
  const teamIds = memberships.flatMap((membership: { teamId?: string | null }) => membership.teamId ? [membership.teamId] : []);
  // Exposed so screens can hide self-service actions that the server would
  // reject anyway — e.g. paying an expense you raised yourself.
  const userId = user?.id ?? null;
  // True when the user may approve budgets by role OR by an active delegation.
  const canApproveBudgets = user?.canApproveBudgets ?? false;
  return { isSuperAdmin, roles, teamIds, userId, canApproveBudgets, agency: { id: "agency", name: "Ethree10", type: "agency" as const } };
}
