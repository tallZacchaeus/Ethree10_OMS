import { requirePageRole } from "@/server/auth/page-access";
export default async function OrganizationsLayout({ children }: { children: React.ReactNode }) { await requirePageRole(["agency_admin", "finance_admin"]); return children; }
