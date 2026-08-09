import { requirePageRole } from "@/server/auth/page-access";

/** Billing is Finance's surface; leadership may read it. */
export default async function InvoicesLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["finance_manager", "chief_executive", "agency_admin"]);
  return children;
}
