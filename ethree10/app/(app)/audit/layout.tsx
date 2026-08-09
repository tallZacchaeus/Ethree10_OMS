import { requirePageRole } from "@/server/auth/page-access";

/** The append-only governance record. Agency-wide roles only. */
export default async function AuditLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["chief_executive", "agency_admin", "finance_manager"]);
  return children;
}
