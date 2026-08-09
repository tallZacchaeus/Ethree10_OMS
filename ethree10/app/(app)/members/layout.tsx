import { requirePageRole } from "@/server/auth/page-access";
export default async function MembersLayout({ children }: { children: React.ReactNode }) { await requirePageRole(["chief_executive", "agency_admin", "finance_manager", "branch_head"]); return children; }
