import type { User } from "next-auth";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import { AccountMenu } from "@/components/layout/account-menu";
import { NotificationBell } from "@/components/layout/notification-bell";

interface AppTopbarProps {
  user: User;
}

export function AppTopbar({ user }: AppTopbarProps) {
  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b bg-background px-6">
      <div className="flex items-center gap-4">
        <WorkspaceSwitcher />
      </div>

      <div className="flex items-center gap-2">
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
