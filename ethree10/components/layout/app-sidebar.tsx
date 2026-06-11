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
  Layers,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { E310Logo } from "@/components/brand/e310-logo";
import { cn } from "@/lib/utils/cn";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  allow: Role[] | "all";
}

interface NavSection {
  title: string;
  items: NavItem[];
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

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, allow: "all" },
      { href: "/workspaces", label: "Workspaces", icon: Layers, allow: "all" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/agency/dashboard", label: "Agency", icon: Briefcase, allow: ["agency_admin", "agency_lead"] },
      { href: "/inbox", label: "Inbox", icon: Inbox, allow: TRIAGE },
      { href: "/requests", label: "Requests", icon: FileText, allow: "all" },
      { href: "/projects", label: "Projects", icon: FolderKanban, allow: "all" },
      { href: "/tasks", label: "My Tasks", icon: CheckSquare, allow: AGENCY_EXEC },
    ],
  },
  {
    title: "Organization",
    items: [
      { href: "/members", label: "Members", icon: Users, allow: AGENCY_EXEC },
      { href: "/agency/skills", label: "Skills", icon: Sparkles, allow: ["agency_admin", "agency_lead"] },
      { href: "/departments", label: "Departments", icon: Building2, allow: AGENCY_LEADS },
      { href: "/leads", label: "Leads", icon: Sparkles, allow: ["agency_admin", "agency_lead"] },
    ],
  },
  {
    title: "Insights",
    items: [
      { href: "/reports", label: "Reports", icon: BarChart3, allow: AGENCY_EXEC },
      { href: "/integrations", label: "Integrations", icon: Plug, allow: AGENCY_LEADS },
      { href: "/audit", label: "Audit log", icon: ScrollText, allow: AGENCY_LEADS },
      { href: "/settings", label: "Settings", icon: Settings, allow: "all" },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { roles, isSuperAdmin } = useWorkspace();

  const canSee = (item: NavItem) =>
    item.allow === "all" || isSuperAdmin || item.allow.some((r) => roles.includes(r));

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center border-b border-sidebar-border/70 px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <E310Logo className="h-6 w-auto text-white" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/75">
            OPS
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {NAV_SECTIONS.map((section) => {
          const items = section.items.filter(canSee);
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="mb-6 last:mb-0">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/65">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {items.map(({ href, icon: Icon, label }) => {
                  const active = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-white/[0.06] text-white"
                            : "text-sidebar-foreground/70 hover:bg-white/[0.04] hover:text-white",
                        )}
                      >
                        {active && (
                          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />
                        )}
                        <Icon
                          className={cn(
                            "h-[18px] w-[18px] shrink-0 transition-colors",
                            active ? "text-sidebar-primary" : "text-sidebar-foreground/55 group-hover:text-white",
                          )}
                          strokeWidth={1.75}
                        />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border/70 px-6 py-4">
        <p className="text-[11px] font-medium text-sidebar-foreground/70">
          E310 · Operating Platform
        </p>
        <p className="text-[10px] text-sidebar-foreground/55">v0.1 — beta</p>
      </div>
    </aside>
  );
}
