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
  return { isSuperAdmin, roles, teamIds, agency: { id: "agency", name: "Ethree10", type: "agency" as const } };
}
