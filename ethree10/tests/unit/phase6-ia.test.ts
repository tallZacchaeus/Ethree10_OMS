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
  "app/(app)/positions/page.tsx",
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
});
