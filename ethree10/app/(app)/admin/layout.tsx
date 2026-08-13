import { requirePageRole } from "@/server/auth/page-access";
import { AGENCY_CONFIG_ROLES } from "@/server/auth/role-groups";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(AGENCY_CONFIG_ROLES);
  return children;
}
