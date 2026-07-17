"use client";

import { trpc } from "@/lib/trpc/client";
import type { Role } from "@prisma/client";

export function useOrganization() {
  const { data: user } = trpc.auth.me.useQuery();
  const isSuperAdmin = user?.isSuperAdmin ?? false;
  const roles = user?.memberships?.map((m: { role: string }) => m.role as Role) ?? [];
  const activeOrganizationId = "agency";

  return {
    isSuperAdmin,
    roles,
    activeOrganizationId,
    activeOrganization: { id: "agency", name: "Agency", type: "agency" },
  };
}
