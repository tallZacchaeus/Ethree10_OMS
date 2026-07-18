import { requirePageRole } from "@/server/auth/page-access";
export default async function PositionsLayout({ children }: { children: React.ReactNode }) { await requirePageRole(["agency_admin"]); return children; }
