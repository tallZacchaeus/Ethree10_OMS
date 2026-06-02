export const dynamic = "force-dynamic";

import Link from "next/link";
import { ClientMarketingNav } from "@/components/ClientMarketingNav";

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold text-brand-600">
            Ethree10
          </Link>
          <ClientMarketingNav />
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t bg-neutral-50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-brand-600">Ethree10</p>
            <p className="text-xs text-muted-foreground">
              A Reach4Christ Global initiative. Excellence through People, Process, Product.
            </p>
          </div>
          <nav className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <Link href="/services" className="hover:text-foreground">
              Services
            </Link>
            <Link href="/about" className="hover:text-foreground">
              About
            </Link>
            <Link href="/request" className="hover:text-foreground">
              Start a project
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
