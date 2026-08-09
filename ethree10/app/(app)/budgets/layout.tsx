import { requirePageRole } from "@/server/auth/page-access";

/** Budget approval is the Chief Executive's surface. */
export default async function BudgetsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["chief_executive"]);
  return children;
}
