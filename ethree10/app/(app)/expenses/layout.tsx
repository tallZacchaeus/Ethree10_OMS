import { requirePageRole } from "@/server/auth/page-access";

/** Spend requests are raised by delivery leads and paid by Finance. */
export default async function ExpensesLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["finance_manager", "agency_admin", "branch_head", "department_lead"]);
  return children;
}
