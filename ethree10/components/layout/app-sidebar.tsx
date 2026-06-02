"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Inbox,
  FileText,
  FolderKanban,
  CheckSquare,
  Users,
  Building2,
  Sparkles,
  Plug,
  BarChart3,
  ScrollText,
  Settings,
  Briefcase,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  allow: Role[] | "all";
}

const AGENCY_EXEC: Role[] = [
  "agency_admin",
  "agency_lead",
  "department_lead",
  "subunit_lead",
  "member",
  "project_manager",
];
const AGENCY_LEADS: Role[] = ["agency_admin", "agency_lead", "department_lead"];
const TRIAGE: Role[] = ["agency_admin", "agency_lead", "department_lead", "project_manager"];

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, allow: "all" },
  { href: "/agency/dashboard", label: "Agency Dashboard", icon: Briefcase, allow: ["agency_lead"] },
  { href: "/agency/skills", label: "Skills Marketplace", icon: Users, allow: ["agency_lead"] },
  { href: "/inbox", label: "Inbox", icon: Inbox, allow: TRIAGE },
  { href: "/requests", label: "Requests", icon: FileText, allow: "all" },
  { href: "/projects", label: "Projects", icon: FolderKanban, allow: "all" },
  { href: "/tasks", label: "My Tasks", icon: CheckSquare, allow: AGENCY_EXEC },
  { href: "/members", label: "Members", icon: Users, allow: AGENCY_EXEC },
  { href: "/departments", label: "Departments", icon: Building2, allow: AGENCY_LEADS },
  { href: "/leads", label: "Leads", icon: Sparkles, allow: ["agency_admin", "agency_lead"] },
  { href: "/integrations", label: "Integrations", icon: Plug, allow: AGENCY_LEADS },
  { href: "/reports", label: "Reports", icon: BarChart3, allow: AGENCY_EXEC },
  { href: "/audit", label: "Audit log", icon: ScrollText, allow: AGENCY_LEADS },
  { href: "/settings", label: "Settings", icon: Settings, allow: "all" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { roles, isSuperAdmin } = useWorkspace();

  const visible = NAV_ITEMS.filter((item) => {
    if (item.allow === "all" || isSuperAdmin) return true;
    return item.allow.some((r) => roles.includes(r));
  });

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="text-xl font-bold text-sidebar-primary">E10</span>
          <span className="text-sm font-medium text-sidebar-foreground/80">OMS</span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {visible.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <p className="px-3 text-xs text-sidebar-foreground/40">Ethree10 OMS v0.1</p>
      </div>
    </aside>
  );
}
