import { requirePageRole } from "@/server/auth/page-access";
import { DELIVERY_LEAD_ROLES } from "@/server/auth/role-groups";

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(DELIVERY_LEAD_ROLES);
  return children;
}
