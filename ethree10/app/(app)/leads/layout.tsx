import { requirePageRole } from "@/server/auth/page-access";

/** Commercial enquiries. */
export default async function LeadsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["finance_manager", "chief_executive", "agency_admin"]);
  return children;
}
