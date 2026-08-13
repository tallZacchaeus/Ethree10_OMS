import { requirePageRole } from "@/server/auth/page-access";
import { AGENCY_WIDE_ROLES } from "@/server/auth/role-groups";

/** Commercial enquiries. */
export default async function LeadsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(AGENCY_WIDE_ROLES);
  return children;
}
