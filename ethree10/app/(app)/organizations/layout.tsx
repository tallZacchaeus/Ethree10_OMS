import { requirePageRole } from "@/server/auth/page-access";
export default async function OrganizationsLayout({ children }: { children: React.ReactNode }) { await requirePageRole(["chief_executive", "agency_admin", "finance_manager"]); return children; }
