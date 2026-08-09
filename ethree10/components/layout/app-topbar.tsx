import type { User } from "next-auth";

import { AccountMenu } from "@/components/layout/account-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { MobileNav } from "@/components/layout/mobile-nav";
import { GlobalSearch } from "@/components/layout/global-search";

interface AppTopbarProps {
  user: User;
}

export function AppTopbar({ user }: AppTopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/80 px-4 backdrop-blur-md md:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <MobileNav />

        <GlobalSearch />
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
