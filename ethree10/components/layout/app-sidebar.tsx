"use client";


import { useAgencyContext } from "@/components/providers/agency-provider";
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
  FileSpreadsheet,
  ReceiptText,
  ClipboardCheck,
  Activity,
  Bell,
  UserCircle,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";

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

const STAFF: Role[] = ["agency_admin", "finance_admin", "team_head", "team_member"];
const TEAM_LEADS: Role[] = ["agency_admin", "team_head"];
const AGENCY_LEADS: Role[] = ["agency_admin", "finance_admin"];
const AGENCY_ADMIN: Role[] = ["agency_admin"];
const FINANCE: Role[] = ["agency_admin", "finance_admin"];

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, allow: "all" },
      { href: "/my-work", label: "My Work", icon: CheckSquare, allow: STAFF },
      { href: "/my-contributions", label: "My Contributions", icon: TrendingUp, allow: STAFF },
      { href: "/inbox", label: "Inbox", icon: Inbox, allow: "all" },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/requests", label: "Requests", icon: FileText, allow: "all" },
      { href: "/projects", label: "Projects", icon: FolderKanban, allow: "all" },
      { href: "/tasks", label: "Tasks", icon: CheckSquare, allow: STAFF },
    ],
  },
  {
    title: "Team Leadership",
    items: [
      { href: "/team/dashboard", label: "Team Dashboard", icon: LayoutDashboard, allow: TEAM_LEADS },
      { href: "/team/intake", label: "Intake", icon: FileText, allow: TEAM_LEADS },
      { href: "/team/assignments", label: "Assignments", icon: Briefcase, allow: TEAM_LEADS },
      { href: "/team/workload", label: "Workload", icon: Activity, allow: TEAM_LEADS },
      { href: "/team/reviews", label: "Reviews", icon: ClipboardCheck, allow: TEAM_LEADS },
      { href: "/team/reports", label: "Team Reports", icon: BarChart3, allow: TEAM_LEADS },
      { href: "/team/members", label: "Team Members", icon: Users, allow: TEAM_LEADS },
    ],
  },
  {
    title: "Agency",
    items: [
      { href: "/agency/dashboard", label: "Agency Dashboard", icon: Briefcase, allow: AGENCY_LEADS },
      { href: "/organizations", label: "Organizations", icon: Layers, allow: AGENCY_LEADS },
      { href: "/members", label: "People", icon: Users, allow: [...AGENCY_LEADS, "team_head"] },
      { href: "/teams", label: "Teams", icon: Building2, allow: AGENCY_LEADS },
      { href: "/agency/skills", label: "Skills", icon: Sparkles, allow: AGENCY_ADMIN },
      { href: "/reports", label: "Reports", icon: BarChart3, allow: [...AGENCY_LEADS, "team_head"] },
      { href: "/audit", label: "Audit", icon: ScrollText, allow: AGENCY_LEADS },
    ],
  },
  {
    title: "Commercial",
    items: [
      { href: "/leads", label: "Enquiries", icon: Sparkles, allow: FINANCE },
      { href: "/invoices", label: "Invoices", icon: FileSpreadsheet, allow: FINANCE },
      { href: "/receipts", label: "Receipts", icon: ReceiptText, allow: FINANCE },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell, allow: "all" },
      { href: "/profile", label: "Profile", icon: UserCircle, allow: "all" },
      { href: "/integrations", label: "Integrations", icon: Plug, allow: AGENCY_ADMIN },
      { href: "/settings", label: "Settings", icon: Settings, allow: "all" },
      { href: "/settings/services", label: "Services", icon: Briefcase, allow: TEAM_LEADS },
    ],
  },
];

/** Shared sidebar inner content — used by the desktop rail and the mobile drawer. */
export function SidebarContent() {
  const pathname = usePathname();
  const { isSuperAdmin, roles } = useAgencyContext();
  const sections = NAV_SECTIONS;

  const canSee = (item: NavItem) =>
    item.allow === "all" || isSuperAdmin || item.allow.some((r) => roles.includes(r as Role));

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-sidebar-border/70 px-6">
        <Link href="/dashboard" className="flex items-center gap-2.5 transition-opacity hover:opacity-80">
          <E310Logo variant="white" className="h-6 w-auto" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/75">
            OPS
          </span>
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {sections.map((section) => {
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
    </div>
  );
}

/** Desktop sidebar rail — hidden below `lg`, where the mobile drawer takes over. */
export function AppSidebar() {
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <SidebarContent />
    </aside>
  );
}
