import { requirePageRole } from "@/server/auth/page-access";

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["agency_admin", "branch_head", "department_lead"]);
  return children;
}
