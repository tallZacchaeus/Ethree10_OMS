import { requirePageAction } from "@/server/auth/page-access";

/**
 * Budget approval is the Chief Executive's surface — and, while a delegation is
 * in force, the delegate's. Guarded on the action rather than the role so those
 * two stay in step; a role list here would either lock out a delegated approver
 * or admit one whose delegation has expired.
 */
export default async function BudgetsLayout({ children }: { children: React.ReactNode }) {
  await requirePageAction("budget.approve");
  return children;
}
