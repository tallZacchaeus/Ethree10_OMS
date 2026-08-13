import { requirePageRole } from "@/server/auth/page-access";
import { DELIVERY_LEAD_ROLES, FINANCE_ROLES } from "@/server/auth/role-groups";

/** Spend requests are raised by delivery leads and paid by Finance. */
export default async function ExpensesLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole([...FINANCE_ROLES, ...DELIVERY_LEAD_ROLES]);
  return children;
}
