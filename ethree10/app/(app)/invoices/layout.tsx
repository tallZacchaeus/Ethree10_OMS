import { requirePageRole } from "@/server/auth/page-access";
import { AGENCY_WIDE_ROLES } from "@/server/auth/role-groups";

/** Billing is Finance's surface; leadership may read it. */
export default async function InvoicesLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(AGENCY_WIDE_ROLES);
  return children;
}
