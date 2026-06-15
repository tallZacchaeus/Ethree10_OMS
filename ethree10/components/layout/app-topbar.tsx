import { Search } from "lucide-react";
import type { User } from "next-auth";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { AccountMenu } from "@/components/layout/account-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { MobileNav } from "@/components/layout/mobile-nav";

interface AppTopbarProps {
  user: User;
}

export function AppTopbar({ user }: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <MobileNav />
        <WorkspaceSwitcher />
        <button
          type="button"
          aria-label="Search"
          className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 text-sm text-muted-foreground transition-colors hover:bg-muted lg:flex"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <NotificationBell />
        <AccountMenu
          name={user.name ?? null}
          email={user.email ?? null}
          image={user.image ?? null}
        />
      </div>
    </header>
  );
}
