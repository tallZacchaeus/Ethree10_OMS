import { requirePageRole } from "@/server/auth/page-access";
import { BUDGET_APPROVER_ROLES } from "@/server/auth/role-groups";

/** Budget approval is the Chief Executive's surface. */
export default async function BudgetsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(BUDGET_APPROVER_ROLES);
  return children;
}
