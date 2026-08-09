import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const coreRoutes = [
  "app/(marketing)/request/page.tsx",
  "app/(marketing)/track/[token]/page.tsx",
  "app/(marketing)/track/[token]/accept/page.tsx",
  "app/(marketing)/privacy/page.tsx",
  "app/(app)/dashboard/page.tsx",
  "app/(app)/my-work/page.tsx",
  "app/(app)/my-contributions/page.tsx",
  "app/(app)/notifications/page.tsx",
  "app/(app)/profile/page.tsx",
  "app/(app)/organizations/page.tsx",
  "app/(app)/organizations/[id]/page.tsx",
  "app/(app)/team/intake/page.tsx",
  "app/(app)/team/assignments/page.tsx",
  "app/(app)/team/workload/page.tsx",
  "app/(app)/team/reviews/page.tsx",
  "app/(app)/reports/page.tsx",
  "app/(app)/reports/[id]/page.tsx",
  "app/(app)/members/page.tsx",
  "app/(app)/members/[id]/page.tsx",
  "app/(app)/budgets/page.tsx",
  "app/(app)/expenses/page.tsx",
  "app/(app)/help/page.tsx",
] as const;

describe("Phase 6 core information architecture", () => {
  it("implements every core route selected for the staff release", () => {
    for (const route of coreRoutes) expect(existsSync(resolve(process.cwd(), route)), route).toBe(true);
  });

  it("has no obsolete workspace provider or one-off workspace migration scripts", () => {
    expect(existsSync(resolve(process.cwd(), "components/providers/workspace-provider.tsx"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "prisma/migrate-workspaces.ts"))).toBe(false);
    expect(existsSync(resolve(process.cwd(), "prisma/migrate-roles.ts"))).toBe(false);
  });

  /**
   * Surfaces deliberately removed to keep the product maintainable by a small
   * team. If one of these comes back, it should be a decision, not a drift.
   */
  it("does not carry the surfaces retired in the 2026-08-09 review", () => {
    for (const route of [
      "app/(app)/knowledge/page.tsx",
      "app/(app)/sponsorships/page.tsx",
      "app/(app)/agency/skills/page.tsx",
      "app/(app)/positions/page.tsx",
      "app/api/webhooks/stripe/route.ts",
      "server/services/stripe.ts",
      "server/integrations/trello/index.ts",
    ]) {
      expect(existsSync(resolve(process.cwd(), route)), route).toBe(false);
    }
  });

  it("keeps a usable migration history", () => {
    // Without the lock file Prisma cannot read the folder as a history at all —
    // it was missing on main, which is how the project ended up with no
    // reliable production migration path.
    expect(existsSync(resolve(process.cwd(), "prisma/migrations/migration_lock.toml"))).toBe(true);
    // main's baseline is authoritative; it is already deployed.
    expect(existsSync(resolve(process.cwd(), "prisma/migrations/00000000000000_baseline/migration.sql"))).toBe(true);
  });
});
