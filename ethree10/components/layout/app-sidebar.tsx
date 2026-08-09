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
  BadgeCheck,
  BookOpen,
  Wallet,
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

// Everyone who delivers work. The Chief Executive is deliberately excluded —
// it has no personal queue, so "My Work" would always be empty for it.
const DELIVERY_STAFF: Role[] = ["agency_admin", "branch_head", "department_lead", "team_member"];
// Runs delivery for a branch or department: routing, assignment, review.
const DELIVERY_LEADS: Role[] = ["agency_admin", "branch_head", "department_lead"];
// May restructure a branch and manage the service catalogue.
const BRANCH_LEADS: Role[] = ["agency_admin", "branch_head"];
// Sees the whole agency across every branch.
const AGENCY_WIDE: Role[] = ["chief_executive", "agency_admin", "finance_manager"];
const AGENCY_ADMIN: Role[] = ["agency_admin"];
// Money. The Chief Executive approves budgets; Finance moves the money.
const FINANCE: Role[] = ["finance_manager"];
const BUDGET_APPROVER: Role[] = ["chief_executive"];

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, allow: "all" },
      // "My Work" used to be a second link to /tasks. There is now one entry.
      { href: "/tasks", label: "My Work", icon: CheckSquare, allow: DELIVERY_STAFF },
      { href: "/my-contributions", label: "My Contributions", icon: TrendingUp, allow: DELIVERY_STAFF },
      { href: "/notifications", label: "Notifications", icon: Bell, allow: "all" },
    ],
  },
  {
    title: "Operations",
    items: [
      // Triage queue — only people who can actually route work should see it.
      { href: "/inbox", label: "Intake Queue", icon: Inbox, allow: DELIVERY_LEADS },
      { href: "/requests", label: "Requests", icon: FileText, allow: "all" },
      { href: "/projects", label: "Projects", icon: FolderKanban, allow: "all" },
    ],
  },
  {
    title: "Delivery Leadership",
    items: [
      { href: "/team/dashboard", label: "Branch Dashboard", icon: LayoutDashboard, allow: DELIVERY_LEADS },
      { href: "/team/intake", label: "Brief Review", icon: FileText, allow: DELIVERY_LEADS },
      { href: "/team/assignments", label: "Assignments", icon: Briefcase, allow: DELIVERY_LEADS },
      { href: "/team/workload", label: "Workload", icon: Activity, allow: DELIVERY_LEADS },
      { href: "/team/reviews", label: "Reviews", icon: ClipboardCheck, allow: DELIVERY_LEADS },
    ],
  },
  {
    title: "Money",
    items: [
      // The approval side — the Chief Executive's primary action surface.
      { href: "/budgets", label: "Budget Approvals", icon: BadgeCheck, allow: BUDGET_APPROVER },
      // The execution side — Finance only.
      { href: "/invoices", label: "Invoices", icon: FileSpreadsheet, allow: FINANCE },
      { href: "/receipts", label: "Receipts", icon: ReceiptText, allow: FINANCE },
      { href: "/expenses", label: "Expenses", icon: Wallet, allow: [...FINANCE, ...DELIVERY_LEADS] },
      { href: "/leads", label: "Enquiries", icon: Sparkles, allow: [...FINANCE, "agency_admin"] },
    ],
  },
  {
    title: "Agency",
    items: [
      { href: "/organizations", label: "Clients", icon: Layers, allow: AGENCY_WIDE },
      { href: "/members", label: "People", icon: Users, allow: [...AGENCY_WIDE, "branch_head"] },
      { href: "/teams", label: "Branches", icon: Building2, allow: AGENCY_WIDE },
      { href: "/reports", label: "Reports", icon: BarChart3, allow: [...AGENCY_WIDE, "branch_head", "department_lead"] },
      { href: "/admin/analytics", label: "Analytics", icon: Activity, allow: AGENCY_WIDE },
      { href: "/audit", label: "Audit", icon: ScrollText, allow: AGENCY_WIDE },
    ],
  },
  {
    title: "Administration",
    items: [
      { href: "/settings/services", label: "Service Catalog", icon: Briefcase, allow: BRANCH_LEADS },
      { href: "/integrations", label: "Integrations", icon: Plug, allow: AGENCY_ADMIN },
      { href: "/admin/cms", label: "Marketing Site", icon: FileText, allow: AGENCY_ADMIN },
      { href: "/settings", label: "Settings", icon: Settings, allow: "all" },
      { href: "/profile", label: "My Profile", icon: UserCircle, allow: "all" },
      { href: "/help", label: "How to use E310", icon: BookOpen, allow: "all" },
    ],
  },
];

interface RoleProps {
  /** Resolved on the server so the correct nav renders on first paint. */
  roles?: Role[];
  isSuperAdmin?: boolean;
}

/** Shared sidebar inner content — used by the desktop rail and the mobile drawer. */
export function SidebarContent({ roles: serverRoles, isSuperAdmin: serverIsSuperAdmin }: RoleProps = {}) {
  const pathname = usePathname();
  const client = useAgencyContext();
  // Prefer roles resolved on the server. Without them the first paint showed only
  // the always-visible items and the real nav popped in once the auth query
  // resolved — very visible on a slow connection.
  const roles = serverRoles ?? client.roles;
  const isSuperAdmin = serverIsSuperAdmin ?? client.isSuperAdmin;
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

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 py-5">
        {sections.map((section) => {
          const items = section.items.filter(canSee);
          if (items.length === 0) return null;
          return (
            <div key={section.title} className="mb-6 last:mb-0">
              <p
                id={`nav-section-${section.title.replace(/\s+/g, "-").toLowerCase()}`}
                className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/65"
              >
                {section.title}
              </p>
              <ul
                aria-labelledby={`nav-section-${section.title.replace(/\s+/g, "-").toLowerCase()}`}
                className="space-y-0.5"
              >
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
export function AppSidebar({ roles, isSuperAdmin }: RoleProps = {}) {
  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
      <SidebarContent roles={roles} isSuperAdmin={isSuperAdmin} />
    </aside>
  );
}
