import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("operations runbook", () => {
  it("documents health, smoke, backup, restore, and rollback procedures", () => {
    const contents = readFileSync(resolve(process.cwd(), "docs/operations-runbook.md"), "utf8");

    expect(contents).toContain("/api/health?mode=live");
    expect(contents).toContain("/api/health?mode=ready");
    expect(contents).toContain("pnpm check:smoke");
    expect(contents).toContain("backup-db.sh");
    expect(contents).toContain("backup-minio.sh");
    expect(contents).toMatch(/Restore rehearsal/i);
    expect(contents).toMatch(/Rollback/i);
  });
});
