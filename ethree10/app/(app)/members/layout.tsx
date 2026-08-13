import { requirePageRole } from "@/server/auth/page-access";
import { AGENCY_WIDE_ROLES } from "@/server/auth/role-groups";
export default async function MembersLayout({ children }: { children: React.ReactNode }) { await requirePageRole([...AGENCY_WIDE_ROLES, "branch_head"]); return children; }
