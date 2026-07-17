import { requirePageRole } from "@/server/auth/page-access";

export default async function TeamLayout({ children }: { children: React.ReactNode }) {
  await requirePageRole(["agency_admin", "team_head"]);
  return children;
}
