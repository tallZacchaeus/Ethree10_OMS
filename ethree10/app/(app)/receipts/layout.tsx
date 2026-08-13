import { requirePageRole } from "@/server/auth/page-access";
import { AGENCY_WIDE_ROLES } from "@/server/auth/role-groups";

/** Receipts are the financial record of account. Finance and leadership only. */
export default async function ReceiptsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(AGENCY_WIDE_ROLES);
  return children;
}
