import { requirePageRole } from "@/server/auth/page-access";
import { AGENCY_WIDE_ROLES } from "@/server/auth/role-groups";

/** The append-only governance record. Agency-wide roles only. */
export default async function AuditLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(AGENCY_WIDE_ROLES);
  return children;
}
