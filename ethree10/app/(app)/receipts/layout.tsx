import { requirePageRole } from "@/server/auth/page-access";

/** Receipts are the financial record of account. Finance and leadership only. */
export default async function ReceiptsLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["finance_manager", "chief_executive", "agency_admin"]);
  return children;
}
