import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const GUIDES_DIR = resolve(process.cwd(), "docs/user-guides");

describe("user guides", () => {
  it("use the canonical agency/team and link-tracking language", () => {
    const files = readdirSync(GUIDES_DIR).filter((file) => file.endsWith(".md"));
    const combined = files.map((file) => readFileSync(join(GUIDES_DIR, file), "utf8")).join("\n");

    expect(files).toEqual(
      expect.arrayContaining(["agency-admin.md", "member.md", "requester.md", "reviewer.md", "team-head.md"]),
    );
    expect(files).not.toContain("department-lead.md");
    expect(files).not.toContain("subunit-lead.md");
    expect(combined).not.toMatch(/\bworkspace\b/i);
    expect(combined).not.toMatch(/\bdepartment\b/i);
    expect(combined).toMatch(/secure .*tracking link/i);
    expect(combined).toMatch(/Product Development/);
    expect(combined).toMatch(/Brands & Communications/);
  });
});
